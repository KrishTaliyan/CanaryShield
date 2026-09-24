// Package cache keeps evaluation snapshots in sync through Redis (README 9.9):
// write-through after each commit, pub/sub refresh, startup load and a
// periodic reconciler. PostgreSQL stays the source of truth throughout.
package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"flagguard/platform/internal/models"
)

// Redis keys and channel (README 9.9).
const (
	flagKeyPrefix     = "ff:flag:"
	flagsSetKey       = "ff:flags"
	updatesChannel    = "ff:updates"
	healthKeyPrefix   = "ff:health:"
	exposureKeyPrefix = "ff:exposure:"
)

// healthTTL is how long a guardian health record lives (README 9.8).
const healthTTL = 60 * time.Second

// opTimeout bounds every Redis call so an outage never stalls a request.
const opTimeout = time.Second

// Redis wraps the client used for flag caching and pub/sub.
type Redis struct {
	client *redis.Client
}

// redisLogger sends go-redis's own messages to slog at debug level. The
// cache already logs every failed operation as a warning, so the library's
// per-dial messages would only repeat them several times a second during an
// outage.
type redisLogger struct{}

func (redisLogger) Printf(ctx context.Context, format string, v ...any) {
	slog.DebugContext(ctx, fmt.Sprintf(format, v...), "component", "go-redis")
}

// NewRedis creates a client for url. It does not connect until first use,
// so the platform starts even when Redis is down.
func NewRedis(url string) (*Redis, error) {
	redis.SetLogger(redisLogger{})
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("parsing redis url: %w", err)
	}
	opts.DialTimeout = opTimeout
	opts.ReadTimeout = opTimeout
	opts.WriteTimeout = opTimeout
	opts.MaxRetries = 1
	return &Redis{client: redis.NewClient(opts)}, nil
}

// Close releases the client's connections.
func (r *Redis) Close() error {
	return r.client.Close()
}

// record is the compiled flag stored at ff:flag:{key}. Unlike the API shape,
// it includes the internal ID, salt and guardrail queries.
type record struct {
	ID      string  `json:"id"`
	Salt    string  `json:"salt"`
	Queries queries `json:"guardrailQueries"`
	models.Flag
}

type queries struct {
	CanaryError   string `json:"canaryError"`
	BaselineError string `json:"baselineError"`
	CanarySamples string `json:"canarySamples"`
}

// update is the ff:updates message.
type update struct {
	Key     string `json:"key"`
	Version int    `json:"version"`
}

func encodeFlag(f models.Flag) ([]byte, error) {
	return json.Marshal(record{
		ID:   f.ID,
		Salt: f.Salt,
		Queries: queries{
			CanaryError:   f.Guardrail.CanaryErrorQuery,
			BaselineError: f.Guardrail.BaselineErrorQuery,
			CanarySamples: f.Guardrail.CanarySamplesQuery,
		},
		Flag: f,
	})
}

func decodeFlag(data []byte) (models.Flag, error) {
	var rec record
	if err := json.Unmarshal(data, &rec); err != nil {
		return models.Flag{}, err
	}
	f := rec.Flag
	if rec.ID == "" || rec.Salt == "" || f.Key == "" {
		return models.Flag{}, errors.New("cached flag is missing id, salt or key")
	}
	f.ID = rec.ID
	f.Salt = rec.Salt
	f.Guardrail.CanaryErrorQuery = rec.Queries.CanaryError
	f.Guardrail.BaselineErrorQuery = rec.Queries.BaselineError
	f.Guardrail.CanarySamplesQuery = rec.Queries.CanarySamples
	return f, nil
}

// Store writes a changed flag through to Redis and announces it on
// ff:updates, in one MULTI/EXEC.
func (r *Redis) Store(ctx context.Context, f models.Flag) error {
	data, err := encodeFlag(f)
	if err != nil {
		return fmt.Errorf("encoding flag %q: %w", f.Key, err)
	}
	msg, err := json.Marshal(update{Key: f.Key, Version: f.Version})
	if err != nil {
		return fmt.Errorf("encoding update for %q: %w", f.Key, err)
	}

	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	_, err = r.client.TxPipelined(ctx, func(p redis.Pipeliner) error {
		p.Set(ctx, flagKeyPrefix+f.Key, data, 0)
		p.SAdd(ctx, flagsSetKey, f.Key)
		p.Publish(ctx, updatesChannel, msg)
		return nil
	})
	if err != nil {
		return fmt.Errorf("storing flag %q in redis: %w", f.Key, err)
	}
	return nil
}

// storeAll rewrites every flag and the ff:flags set without announcing
// anything. The reconciler uses it to repair Redis.
func (r *Redis) storeAll(ctx context.Context, list []models.Flag) error {
	encoded := make(map[string][]byte, len(list))
	for _, f := range list {
		data, err := encodeFlag(f)
		if err != nil {
			return fmt.Errorf("encoding flag %q: %w", f.Key, err)
		}
		encoded[f.Key] = data
	}

	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	_, err := r.client.TxPipelined(ctx, func(p redis.Pipeliner) error {
		p.Del(ctx, flagsSetKey)
		for key, data := range encoded {
			p.Set(ctx, flagKeyPrefix+key, data, 0)
			p.SAdd(ctx, flagsSetKey, key)
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("storing %d flags in redis: %w", len(list), err)
	}
	return nil
}

// loadFlag reads one compiled flag.
func (r *Redis) loadFlag(ctx context.Context, key string) (models.Flag, error) {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	data, err := r.client.Get(ctx, flagKeyPrefix+key).Bytes()
	if err != nil {
		return models.Flag{}, fmt.Errorf("reading flag %q from redis: %w", key, err)
	}
	f, err := decodeFlag(data)
	if err != nil {
		return models.Flag{}, fmt.Errorf("decoding flag %q from redis: %w", key, err)
	}
	return f, nil
}

// loadAll reads every flag listed in ff:flags. It fails if any listed flag
// is missing or unreadable, so callers never load a partial snapshot.
func (r *Redis) loadAll(ctx context.Context) ([]models.Flag, error) {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()

	keys, err := r.client.SMembers(ctx, flagsSetKey).Result()
	if err != nil {
		return nil, fmt.Errorf("reading %s from redis: %w", flagsSetKey, err)
	}
	if len(keys) == 0 {
		return nil, nil
	}

	redisKeys := make([]string, len(keys))
	for i, k := range keys {
		redisKeys[i] = flagKeyPrefix + k
	}
	values, err := r.client.MGet(ctx, redisKeys...).Result()
	if err != nil {
		return nil, fmt.Errorf("reading flags from redis: %w", err)
	}

	list := make([]models.Flag, 0, len(values))
	for i, v := range values {
		s, ok := v.(string)
		if !ok {
			return nil, fmt.Errorf("flag %q is listed in %s but missing from redis", keys[i], flagsSetKey)
		}
		f, err := decodeFlag([]byte(s))
		if err != nil {
			return nil, fmt.Errorf("decoding flag %q from redis: %w", keys[i], err)
		}
		list = append(list, f)
	}
	return list, nil
}

// SaveHealth replaces the flag's health record and sets its 60 s TTL.
func (r *Redis) SaveHealth(ctx context.Context, h models.Health) error {
	fields := map[string]any{
		"status":      h.Status,
		"samples":     h.Samples,
		"breachCount": h.BreachCount,
		"threshold":   h.Threshold,
	}
	if h.CanaryErrorRate != nil {
		fields["canaryErrorRate"] = *h.CanaryErrorRate
	}
	if h.BaselineErrorRate != nil {
		fields["baselineErrorRate"] = *h.BaselineErrorRate
	}
	if h.CheckedAt != nil {
		fields["checkedAt"] = h.CheckedAt.UTC().Format(time.RFC3339Nano)
	}

	key := healthKeyPrefix + h.FlagKey
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	_, err := r.client.TxPipelined(ctx, func(p redis.Pipeliner) error {
		p.Del(ctx, key)
		p.HSet(ctx, key, fields)
		p.Expire(ctx, key, healthTTL)
		return nil
	})
	if err != nil {
		return fmt.Errorf("saving health for %q: %w", h.FlagKey, err)
	}
	return nil
}

// LoadHealth reads a flag's health record. found is false when none exists.
func (r *Redis) LoadHealth(ctx context.Context, flagKey string) (h models.Health, found bool, err error) {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	fields, err := r.client.HGetAll(ctx, healthKeyPrefix+flagKey).Result()
	if err != nil {
		return models.Health{}, false, fmt.Errorf("loading health for %q: %w", flagKey, err)
	}
	if len(fields) == 0 {
		return models.Health{}, false, nil
	}

	h = models.Health{FlagKey: flagKey, Status: fields["status"]}
	h.Samples, _ = strconv.Atoi(fields["samples"])
	h.BreachCount, _ = strconv.Atoi(fields["breachCount"])
	h.Threshold, _ = strconv.ParseFloat(fields["threshold"], 64)
	h.CanaryErrorRate = parseOptionalFloat(fields["canaryErrorRate"])
	h.BaselineErrorRate = parseOptionalFloat(fields["baselineErrorRate"])
	if t, err := time.Parse(time.RFC3339Nano, fields["checkedAt"]); err == nil {
		h.CheckedAt = &t
	}
	return h, true, nil
}

// HealthStatuses returns the health status of each flag that has a record.
func (r *Redis) HealthStatuses(ctx context.Context, flagKeys []string) (map[string]string, error) {
	statuses := make(map[string]string, len(flagKeys))
	if len(flagKeys) == 0 {
		return statuses, nil
	}

	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	cmds := make([]*redis.StringCmd, len(flagKeys))
	_, err := r.client.Pipelined(ctx, func(p redis.Pipeliner) error {
		for i, key := range flagKeys {
			cmds[i] = p.HGet(ctx, healthKeyPrefix+key, "status")
		}
		return nil
	})
	if err != nil && !errors.Is(err, redis.Nil) {
		return nil, fmt.Errorf("loading health statuses: %w", err)
	}
	for i, cmd := range cmds {
		if status, err := cmd.Result(); err == nil && status != "" {
			statuses[flagKeys[i]] = status
		}
	}
	return statuses, nil
}

// AddExposures records users served the treatment in the flag's HyperLogLog.
func (r *Redis) AddExposures(ctx context.Context, flagKey string, userIDs []string) error {
	members := make([]any, len(userIDs))
	for i, id := range userIDs {
		members[i] = id
	}
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	if err := r.client.PFAdd(ctx, exposureKeyPrefix+flagKey, members...).Err(); err != nil {
		return fmt.Errorf("recording exposures for %q: %w", flagKey, err)
	}
	return nil
}

// ExposureCount returns the approximate number of distinct exposed users.
func (r *Redis) ExposureCount(ctx context.Context, flagKey string) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	n, err := r.client.PFCount(ctx, exposureKeyPrefix+flagKey).Result()
	if err != nil {
		return 0, fmt.Errorf("counting exposures for %q: %w", flagKey, err)
	}
	return int(n), nil
}

// ResetExposure clears the flag's exposure counter.
func (r *Redis) ResetExposure(ctx context.Context, flagKey string) error {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	if err := r.client.Del(ctx, exposureKeyPrefix+flagKey).Err(); err != nil {
		return fmt.Errorf("resetting exposures for %q: %w", flagKey, err)
	}
	return nil
}

func parseOptionalFloat(s string) *float64 {
	if s == "" {
		return nil
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	return &v
}
