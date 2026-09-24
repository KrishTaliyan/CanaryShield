package cache

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"flagguard/platform/internal/evaluation"
)

// ReconcileInterval is how often everything is reloaded from PostgreSQL.
const ReconcileInterval = 30 * time.Second

// LoadSnapshot fills the snapshot at startup from Redis, falling back to
// PostgreSQL when Redis is down, empty or incomplete. It fails only when
// neither source can be read.
func LoadSnapshot(ctx context.Context, r *Redis, pg Loader, snapshot *evaluation.Snapshot) error {
	list, err := r.loadAll(ctx)
	if err == nil && len(list) > 0 {
		snapshot.Replace(list)
		slog.Info("snapshot loaded from redis", "flags", len(list))
		return nil
	}
	if err != nil {
		slog.Warn("loading snapshot from redis failed; using postgres", "error", err)
	}

	list, err = pg.List(ctx)
	if err != nil {
		return fmt.Errorf("loading snapshot from postgres: %w", err)
	}
	snapshot.Replace(list)
	slog.Info("snapshot loaded from postgres", "flags", len(list))

	if err := r.storeAll(ctx, list); err != nil {
		slog.Warn("seeding redis failed; will retry in the reconciler", "error", err)
	}
	return nil
}

// RunReconciler reloads every flag from PostgreSQL each interval until ctx
// is done, repairing both the snapshot and Redis.
func RunReconciler(ctx context.Context, r *Redis, pg Loader, snapshot *evaluation.Snapshot, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			reconcile(ctx, r, pg, snapshot)
		}
	}
}

func reconcile(ctx context.Context, r *Redis, pg Loader, snapshot *evaluation.Snapshot) {
	list, err := pg.List(ctx)
	if err != nil {
		slog.Warn("reconciler: loading flags from postgres failed; keeping the current snapshot", "error", err)
		return
	}
	snapshot.Replace(list)
	if err := r.storeAll(ctx, list); err != nil {
		slog.Warn("reconciler: redis unavailable; serving from the in-memory snapshot", "error", err)
	}
}
