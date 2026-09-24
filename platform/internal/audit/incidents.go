package audit

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5"

	"flagguard/platform/internal/db"
	"flagguard/platform/internal/models"
)

// ErrIncidentNotFound is returned when no incident has the given ID.
var ErrIncidentNotFound = errors.New("incident not found")

// NewIncident describes an incidents row to insert.
type NewIncident struct {
	FlagID            string
	FlagKey           string
	ObservedErrorRate float64
	BaselineErrorRate *float64
	Threshold         float64
	ExposedPercentage float64
	ExposedUsers      *int
	SampleSize        int
	Reason            string
	FirstBreachAt     time.Time
	RolledBackAt      time.Time
}

const selectIncidents = `
	SELECT i.id::text, f.key, i.status, i.observed_error_rate, i.baseline_error_rate, i.threshold,
	       i.exposed_percentage, i.exposed_users, i.sample_size, i.reason,
	       i.first_breach_at, i.rolled_back_at, i.resolved_at
	FROM incidents i
	JOIN flags f ON f.id = i.flag_id`

func scanIncident(row pgx.Row) (models.Incident, error) {
	var inc models.Incident
	err := row.Scan(&inc.ID, &inc.FlagKey, &inc.Status, &inc.ObservedErrorRate, &inc.BaselineErrorRate,
		&inc.Threshold, &inc.ExposedPercentage, &inc.ExposedUsers, &inc.SampleSize, &inc.Reason,
		&inc.FirstBreachAt, &inc.RolledBackAt, &inc.ResolvedAt)
	inc.FirstBreachAt = inc.FirstBreachAt.UTC()
	inc.RolledBackAt = inc.RolledBackAt.UTC()
	if inc.ResolvedAt != nil {
		t := inc.ResolvedAt.UTC()
		inc.ResolvedAt = &t
	}
	return inc, err
}

// InsertIncident writes a new open incident and returns it as stored.
func InsertIncident(ctx context.Context, q db.Querier, n NewIncident) (models.Incident, error) {
	var baseline *float64
	if n.BaselineErrorRate != nil {
		b := round4(*n.BaselineErrorRate)
		baseline = &b
	}
	var id string
	err := q.QueryRow(ctx, `
		INSERT INTO incidents (flag_id, observed_error_rate, baseline_error_rate, threshold,
		                       exposed_percentage, exposed_users, sample_size, reason,
		                       first_breach_at, rolled_back_at)
		VALUES ($1::text::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id::text`,
		n.FlagID, round4(n.ObservedErrorRate), baseline, round4(n.Threshold),
		n.ExposedPercentage, n.ExposedUsers, n.SampleSize, n.Reason,
		n.FirstBreachAt, n.RolledBackAt,
	).Scan(&id)
	if err != nil {
		return models.Incident{}, fmt.Errorf("inserting incident: %w", err)
	}
	return GetIncident(ctx, q, id)
}

// ListIncidents returns incidents newest first, optionally filtered by status.
func ListIncidents(ctx context.Context, q db.Querier, status string) ([]models.Incident, error) {
	rows, err := q.Query(ctx, selectIncidents+`
		WHERE $1 = '' OR i.status = $1
		ORDER BY i.rolled_back_at DESC, i.id`, status)
	if err != nil {
		return nil, fmt.Errorf("querying incidents: %w", err)
	}
	defer rows.Close()

	list := []models.Incident{}
	for rows.Next() {
		inc, err := scanIncident(rows)
		if err != nil {
			return nil, fmt.Errorf("scanning incident: %w", err)
		}
		list = append(list, inc)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reading incidents: %w", err)
	}
	return list, nil
}

// GetIncident returns one incident. id must be a valid UUID.
func GetIncident(ctx context.Context, q db.Querier, id string) (models.Incident, error) {
	inc, err := scanIncident(q.QueryRow(ctx, selectIncidents+` WHERE i.id = $1::text::uuid`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Incident{}, fmt.Errorf("%w: %q", ErrIncidentNotFound, id)
	}
	if err != nil {
		return models.Incident{}, fmt.Errorf("querying incident %q: %w", id, err)
	}
	return inc, nil
}

// ResolveIncident marks an open incident resolved. changed is false when it
// was already resolved, in which case it is returned unchanged.
func ResolveIncident(ctx context.Context, q db.Querier, id string) (inc models.Incident, changed bool, err error) {
	tag, err := q.Exec(ctx, `
		UPDATE incidents SET status = 'resolved', resolved_at = now()
		WHERE id = $1::text::uuid AND status = 'open'`, id)
	if err != nil {
		return models.Incident{}, false, fmt.Errorf("resolving incident %q: %w", id, err)
	}
	inc, err = GetIncident(ctx, q, id)
	return inc, tag.RowsAffected() == 1, err
}

// round4 matches the NUMERIC(6,4) columns.
func round4(v float64) float64 {
	return math.Round(v*10000) / 10000
}
