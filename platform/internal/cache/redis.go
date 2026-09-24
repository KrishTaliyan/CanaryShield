// Package cache keeps evaluation snapshots in sync through Redis (README 9.9):
// write-through after each commit, pub/sub refresh, startup load and a
// periodic reconciler. PostgreSQL stays the source of truth throughout.
package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"flagguard/platform/internal/models"
)

// Redis keys and channel (README 9.9).
const (
	flagKeyPrefix  = "ff:flag:"
	flagsSetKey    = "ff:flags"
	updatesChannel = "ff:updates"
)

// opTimeout bounds every Redis call so an outage never stalls a request.
const opTimeout = time.Second

// Redis wraps the client used for flag caching and pub/sub.
type Redis struct {
	client *redis.Client
}

// NewRedis creates a client for url. It does not connect until first use,
// so the platform starts even when Redis is down.
func NewRedis(url string) (*Redis, error) {
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
