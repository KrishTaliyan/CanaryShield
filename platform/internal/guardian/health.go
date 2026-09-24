package guardian

import (
	"context"
	"errors"
	"log/slog"
	"math"
	"time"

	"flagguard/platform/internal/flags"
	"flagguard/platform/internal/models"
	"flagguard/platform/internal/rollout"
)

// check runs one guardian check for f (README 9.5 steps 1–5). It never rolls
// back on missing data: a Prometheus failure or an empty or NaN error rate
// skips the tick.
func (g *Guardian) check(ctx context.Context, f models.Flag) {
	gr := f.Guardrail

	samplesValue, ok, err := g.prom.Scalar(ctx, gr.CanarySamplesQuery)
	if err != nil {
		slog.Warn("guardian: prometheus unavailable; skipping this tick", "flag", f.Key, "error", err)
		return
	}
	samples := 0
	if ok {
		samples = int(math.Round(samplesValue))
	}

	b := g.breachFor(f)
	h := models.Health{
		FlagKey:           f.Key,
		BaselineErrorRate: g.optionalScalar(ctx, gr.BaselineErrorQuery),
		Samples:           samples,
		BreachCount:       b.count,
		Threshold:         gr.ErrorRateThreshold,
	}

	// Step 1: too little canary traffic to judge; the breach count is kept.
	if samples < gr.MinSamples {
		h.Status = models.HealthInsufficientData
		g.report(ctx, h)
		return
	}

	// Step 2: no usable error rate means no decision this tick.
	rate, ok, err := g.prom.Scalar(ctx, gr.CanaryErrorQuery)
	if err != nil || !ok {
		slog.Warn("guardian: no canary error rate; skipping this tick", "flag", f.Key, "error", err)
		return
	}
	h.CanaryErrorRate = &rate

	// Step 3: count consecutive breaches.
	if rate > gr.ErrorRateThreshold {
		if b.count == 0 {
			b.firstAt = g.now()
		}
		b.count++
	} else {
		b.count = 0
		b.firstAt = time.Time{}
	}
	h.BreachCount = b.count

	// Steps 4 and 5.
	switch {
	case b.count >= gr.ConsecutiveBreaches:
		h.Status = models.HealthBreached
		g.rollbackOrRetry(ctx, f, rate, h.BaselineErrorRate, samples, b)
	case b.count > 0:
		h.Status = models.HealthWarning
	default:
		h.Status = models.HealthHealthy
	}
	g.report(ctx, h)
}

// rollbackOrRetry rolls f back. If the flag changed since the snapshot was
// read, it reloads the flag so the next tick re-checks the current state.
func (g *Guardian) rollbackOrRetry(ctx context.Context, f models.Flag, rate float64, baseline *float64, samples int, b *breach) {
	err := g.rollback(ctx, f, rate, baseline, samples, b)
	if err == nil {
		delete(g.breaches, f.Key)
		return
	}

	var transitionErr *rollout.TransitionError
	if !errors.Is(err, flags.ErrVersionConflict) && !errors.As(err, &transitionErr) {
		slog.Error("guardian: rollback failed; will retry next tick", "flag", f.Key, "error", err)
		return
	}
	slog.Info("guardian: flag changed before rollback; re-checking next tick", "flag", f.Key, "reason", err)
	fresh, err := g.flags.Get(ctx, f.Key)
	if err != nil {
		slog.Warn("guardian: reloading flag failed", "flag", f.Key, "error", err)
		return
	}
	g.snapshot.Set(fresh)
}

// report stores the health record in Redis (60 s TTL) and broadcasts it.
func (g *Guardian) report(ctx context.Context, h models.Health) {
	now := g.now()
	h.CheckedAt = &now
	if err := g.store.SaveHealth(ctx, h); err != nil {
		slog.Warn("guardian: saving health to redis failed", "flag", h.FlagKey, "error", err)
	}
	g.events.PublishHealth(h)
}

// optionalScalar returns a query's value, or nil when there is none.
func (g *Guardian) optionalScalar(ctx context.Context, query string) *float64 {
	v, ok, err := g.prom.Scalar(ctx, query)
	if err != nil || !ok {
		return nil
	}
	return &v
}

// Health returns a flag's latest health record, or NOT_MONITORED when there
// is none (README 9.5).
func (g *Guardian) Health(ctx context.Context, flagKey string) (models.Health, error) {
	f, err := g.flags.Get(ctx, flagKey)
	if err != nil {
		return models.Health{}, err
	}
	h, found, err := g.store.LoadHealth(ctx, flagKey)
	if err != nil {
		slog.Warn("loading health failed; reporting NOT_MONITORED", "flag", flagKey, "error", err)
	}
	if err != nil || !found {
		return models.Health{
			FlagKey:   flagKey,
			Status:    models.HealthNotMonitored,
			Threshold: f.Guardrail.ErrorRateThreshold,
		}, nil
	}
	return h, nil
}
