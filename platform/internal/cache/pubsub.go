package cache

import (
	"context"
	"encoding/json"
	"log/slog"

	"flagguard/platform/internal/evaluation"
	"flagguard/platform/internal/models"
)

// Loader reads flags from PostgreSQL, the source of truth.
type Loader interface {
	List(ctx context.Context) ([]models.Flag, error)
	Get(ctx context.Context, key string) (models.Flag, error)
}

// Subscribe applies ff:updates messages to the snapshot until ctx is done.
// The client reconnects and resubscribes by itself after a Redis outage.
func (r *Redis) Subscribe(ctx context.Context, snapshot *evaluation.Snapshot, pg Loader) {
	ps := r.client.Subscribe(ctx, updatesChannel)
	defer ps.Close()

	messages := ps.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-messages:
			if !ok {
				return
			}
			r.applyUpdate(ctx, snapshot, pg, msg.Payload)
		}
	}
}

// applyUpdate reloads the announced flag unless the snapshot already has
// that version. It reads Redis first and falls back to PostgreSQL.
func (r *Redis) applyUpdate(ctx context.Context, snapshot *evaluation.Snapshot, pg Loader, payload string) {
	var u update
	if err := json.Unmarshal([]byte(payload), &u); err != nil || u.Key == "" {
		slog.Warn("ignoring malformed ff:updates message", "payload", payload)
		return
	}
	if cur, ok := snapshot.Get(u.Key); ok && cur.Version >= u.Version {
		return
	}

	f, err := r.loadFlag(ctx, u.Key)
	if err != nil {
		slog.Warn("reloading flag from redis failed; trying postgres", "flag", u.Key, "error", err)
		if f, err = pg.Get(ctx, u.Key); err != nil {
			slog.Warn("reloading flag from postgres failed", "flag", u.Key, "error", err)
			return
		}
	}
	snapshot.Set(f)
}
