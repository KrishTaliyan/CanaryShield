// Package guardian watches canary health in Prometheus and rolls flags back
// automatically when the canary error rate breaks the guardrail (README 9.5).
package guardian

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"flagguard/platform/internal/evaluation"
	"flagguard/platform/internal/flags"
	"flagguard/platform/internal/models"
)

// TickInterval is how often every monitored flag is checked (README 9.8).
const TickInterval = 5 * time.Second

var rollbacksTotal = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "ff_rollbacks_total",
	Help: "Automatic rollbacks performed by the guardian, by flag.",
}, []string{"flag"})

// Prometheus runs instant PromQL queries. ok is false for empty or NaN results.
type Prometheus interface {
	Scalar(ctx context.Context, query string) (value float64, ok bool, err error)
}

// Store keeps health records and exposure counts in Redis.
type Store interface {
	SaveHealth(ctx context.Context, h models.Health) error
	LoadHealth(ctx context.Context, flagKey string) (models.Health, bool, error)
	ExposureCount(ctx context.Context, flagKey string) (int, error)
}

// Events broadcasts guardian results to dashboards.
type Events interface {
	PublishHealth(h models.Health)
	PublishIncident(i models.Incident)
}

// Guardian checks monitored flags every tick and rolls back bad canaries.
type Guardian struct {
	pool     *pgxpool.Pool
	flags    *flags.Service
	snapshot *evaluation.Snapshot
	prom     Prometheus
	store    Store
	events   Events
	now      func() time.Time

	// breaches is only touched by the Run goroutine.
	breaches map[string]*breach
}

// breach tracks consecutive threshold breaches for one flag.
type breach struct {
	flagID  string
	count   int
	firstAt time.Time
}

// New returns a guardian. Call Run to start it.
func New(pool *pgxpool.Pool, flagService *flags.Service, snapshot *evaluation.Snapshot,
	prom Prometheus, store Store, events Events) *Guardian {
	return &Guardian{
		pool:     pool,
		flags:    flagService,
		snapshot: snapshot,
		prom:     prom,
		store:    store,
		events:   events,
		now:      func() time.Time { return time.Now().UTC() },
		breaches: map[string]*breach{},
	}
}

// Run checks every monitored flag each TickInterval until ctx is done.
func (g *Guardian) Run(ctx context.Context) {
	ticker := time.NewTicker(TickInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			g.tick(ctx)
		}
	}
}

// tick checks each monitored flag once and forgets flags no longer monitored.
func (g *Guardian) tick(ctx context.Context) {
	seen := map[string]bool{}
	for _, f := range g.snapshot.All() {
		if !monitored(f) {
			continue
		}
		seen[f.Key] = true
		g.check(ctx, *f)
	}
	for key := range g.breaches {
		if !seen[key] {
			delete(g.breaches, key)
		}
	}
}

// monitored reports whether the guardian watches f: rolling out or paused,
// with its guardrail enabled.
func monitored(f *models.Flag) bool {
	return f.Guardrail.Enabled &&
		(f.Status == models.StatusRollingOut || f.Status == models.StatusPaused)
}

// breachFor returns f's breach tracker, starting fresh if the flag was
// recreated under the same key.
func (g *Guardian) breachFor(f models.Flag) *breach {
	b, ok := g.breaches[f.Key]
	if !ok || b.flagID != f.ID {
		b = &breach{flagID: f.ID}
		g.breaches[f.Key] = b
	}
	return b
}
