package guardian

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"

	"github.com/jackc/pgx/v5"

	"flagguard/platform/internal/audit"
	"flagguard/platform/internal/flags"
	"flagguard/platform/internal/models"
)

const auditEntityIncident = "incident"

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// rollback rolls f back to 0% and opens an incident in one transaction with
// an optimistic version check (README 9.5 step 4). The flags service then
// updates the snapshot and Redis and broadcasts the flag and rollout event;
// rollback broadcasts the incident and counts ff_rollbacks_total.
func (g *Guardian) rollback(ctx context.Context, f models.Flag, rate float64, baseline *float64, samples int, b *breach) error {
	gr := f.Guardrail
	reason := fmt.Sprintf("Canary error rate %.1f%% exceeded threshold %.1f%% for %d consecutive checks",
		rate*100, gr.ErrorRateThreshold*100, b.count)
	exposedUsers := g.exposedUsers(ctx, f.Key)
	rolledBackAt := g.now()

	var incident models.Incident
	_, err := g.flags.GuardianRollback(ctx, f.Key, f.Version, reason,
		func(ctx context.Context, tx pgx.Tx, before models.Flag) error {
			var err error
			incident, err = audit.InsertIncident(ctx, tx, audit.NewIncident{
				FlagID:            before.ID,
				FlagKey:           before.Key,
				ObservedErrorRate: rate,
				BaselineErrorRate: baseline,
				Threshold:         gr.ErrorRateThreshold,
				ExposedPercentage: before.RolloutPercentage,
				ExposedUsers:      exposedUsers,
				SampleSize:        samples,
				Reason:            reason,
				FirstBreachAt:     b.firstAt,
				RolledBackAt:      rolledBackAt,
			})
			return err
		})
	if err != nil {
		return err
	}

	g.events.PublishIncident(incident)
	rollbacksTotal.WithLabelValues(f.Key).Inc()
	slog.Warn("guardian rolled back flag", "flag", f.Key, "incident", incident.ID,
		"errorRate", rate, "threshold", gr.ErrorRateThreshold,
		"exposedPercentage", incident.ExposedPercentage, "exposedUsers", exposedUsers)
	return nil
}

// exposedUsers reads the flag's exposure counter; nil when Redis is down.
func (g *Guardian) exposedUsers(ctx context.Context, flagKey string) *int {
	n, err := g.store.ExposureCount(ctx, flagKey)
	if err != nil {
		slog.Warn("guardian: counting exposed users failed", "flag", flagKey, "error", err)
		return nil
	}
	return &n
}

// ListIncidents returns incidents newest first. status is "", "open" or
// "resolved"; "" means all.
func (g *Guardian) ListIncidents(ctx context.Context, status string) ([]models.Incident, error) {
	switch status {
	case "", models.IncidentOpen, models.IncidentResolved:
	default:
		return nil, &flags.ValidationError{Message: "status must be open or resolved"}
	}
	return audit.ListIncidents(ctx, g.pool, status)
}

// GetIncident returns one incident.
func (g *Guardian) GetIncident(ctx context.Context, id string) (models.Incident, error) {
	if !uuidPattern.MatchString(id) {
		return models.Incident{}, fmt.Errorf("%w: %q", audit.ErrIncidentNotFound, id)
	}
	return audit.GetIncident(ctx, g.pool, id)
}

// ResolveIncident marks an incident resolved. Resolving an already resolved
// incident returns it unchanged.
func (g *Guardian) ResolveIncident(ctx context.Context, id string) (models.Incident, error) {
	if !uuidPattern.MatchString(id) {
		return models.Incident{}, fmt.Errorf("%w: %q", audit.ErrIncidentNotFound, id)
	}

	var incident models.Incident
	var changed bool
	err := pgx.BeginFunc(ctx, g.pool, func(tx pgx.Tx) error {
		var err error
		if incident, changed, err = audit.ResolveIncident(ctx, tx, id); err != nil || !changed {
			return err
		}
		return audit.InsertAuditLog(ctx, tx, audit.Entry{
			Actor: models.ActorAdmin, Action: "resolved",
			EntityType: auditEntityIncident, EntityID: id, After: incident,
		})
	})
	if err != nil {
		return models.Incident{}, err
	}
	if changed {
		g.events.PublishIncident(incident)
	}
	return incident, nil
}
