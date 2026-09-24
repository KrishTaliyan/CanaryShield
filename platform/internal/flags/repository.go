package flags

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"flagguard/platform/internal/db"
	"flagguard/platform/internal/models"
)

// Default guardrail PromQL (README 8.7), stored when a flag is created.
const (
	defaultCanaryErrorQuery = `sum(rate(quickcart_payment_requests_total{flow="new",outcome="error"}[30s]))
  / sum(rate(quickcart_payment_requests_total{flow="new"}[30s]))`
	defaultBaselineErrorQuery = `sum(rate(quickcart_payment_requests_total{flow="old",outcome="error"}[30s]))
  / sum(rate(quickcart_payment_requests_total{flow="old"}[30s]))`
	defaultCanarySamplesQuery = `sum(increase(quickcart_payment_requests_total{flow="new"}[30s]))`
)

const selectFlags = `
	SELECT f.id::text, f.key, f.name, f.description, f.enabled, f.status,
	       f.control_variant, f.treatment_variant, f.salt,
	       f.rollout_percentage, f.rollout_steps, f.version, f.created_at, f.updated_at,
	       g.enabled, g.error_rate_threshold, g.min_samples, g.consecutive_breaches,
	       g.canary_error_query, g.baseline_error_query, g.canary_samples_query
	FROM flags f
	JOIN guardrails g ON g.flag_id = f.id`

// pgUniqueViolation is the PostgreSQL error code for a unique constraint violation.
const pgUniqueViolation = "23505"

func scanFlag(row pgx.Row) (models.Flag, error) {
	var f models.Flag
	err := row.Scan(
		&f.ID, &f.Key, &f.Name, &f.Description, &f.Enabled, &f.Status,
		&f.ControlVariant, &f.TreatmentVariant, &f.Salt,
		&f.RolloutPercentage, &f.RolloutSteps, &f.Version, &f.CreatedAt, &f.UpdatedAt,
		&f.Guardrail.Enabled, &f.Guardrail.ErrorRateThreshold, &f.Guardrail.MinSamples,
		&f.Guardrail.ConsecutiveBreaches, &f.Guardrail.CanaryErrorQuery,
		&f.Guardrail.BaselineErrorQuery, &f.Guardrail.CanarySamplesQuery,
	)
	f.CreatedAt = f.CreatedAt.UTC()
	f.UpdatedAt = f.UpdatedAt.UTC()
	if f.RolloutSteps == nil {
		f.RolloutSteps = []float64{}
	}
	f.Conditions = []models.Condition{}
	f.Overrides = models.Overrides{Include: []string{}, Exclude: []string{}}
	return f, err
}

// listFlags returns every flag ordered by key.
func listFlags(ctx context.Context, q db.Querier) ([]models.Flag, error) {
	rows, err := q.Query(ctx, selectFlags+` ORDER BY f.key`)
	if err != nil {
		return nil, fmt.Errorf("querying flags: %w", err)
	}
	defer rows.Close()

	list := []models.Flag{}
	for rows.Next() {
		f, err := scanFlag(rows)
		if err != nil {
			return nil, fmt.Errorf("scanning flag: %w", err)
		}
		list = append(list, f)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reading flags: %w", err)
	}

	byID := make(map[string]*models.Flag, len(list))
	ids := make([]string, 0, len(list))
	for i := range list {
		byID[list[i].ID] = &list[i]
		ids = append(ids, list[i].ID)
	}
	if err := loadTargeting(ctx, q, ids, byID); err != nil {
		return nil, err
	}
	return list, nil
}

// getFlag loads one flag by key. With forUpdate it locks the flag row until
// the surrounding transaction ends. Returns ErrNotFound when missing.
func getFlag(ctx context.Context, q db.Querier, key string, forUpdate bool) (models.Flag, error) {
	query := selectFlags + ` WHERE f.key = $1`
	if forUpdate {
		query += ` FOR UPDATE OF f`
	}
	f, err := scanFlag(q.QueryRow(ctx, query, key))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Flag{}, fmt.Errorf("%w: %q", ErrNotFound, key)
	}
	if err != nil {
		return models.Flag{}, fmt.Errorf("querying flag %q: %w", key, err)
	}
	if err := loadTargeting(ctx, q, []string{f.ID}, map[string]*models.Flag{f.ID: &f}); err != nil {
		return models.Flag{}, err
	}
	return f, nil
}

// loadTargeting fills in conditions and overrides for the given flags.
func loadTargeting(ctx context.Context, q db.Querier, ids []string, byID map[string]*models.Flag) error {
	if len(ids) == 0 {
		return nil
	}
	if err := loadConditions(ctx, q, ids, byID); err != nil {
		return err
	}
	return loadOverrides(ctx, q, ids, byID)
}

func loadConditions(ctx context.Context, q db.Querier, ids []string, byID map[string]*models.Flag) error {
	rows, err := q.Query(ctx, `
		SELECT flag_id::text, attribute, operator, match_values
		FROM targeting_conditions
		WHERE flag_id = ANY($1::text[]::uuid[])
		ORDER BY flag_id, sort_order`, ids)
	if err != nil {
		return fmt.Errorf("querying conditions: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var flagID string
		var c models.Condition
		if err := rows.Scan(&flagID, &c.Attribute, &c.Operator, &c.Values); err != nil {
			return fmt.Errorf("scanning condition: %w", err)
		}
		if c.Values == nil {
			c.Values = []any{}
		}
		if f := byID[flagID]; f != nil {
			f.Conditions = append(f.Conditions, c)
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("reading conditions: %w", err)
	}
	return nil
}

func loadOverrides(ctx context.Context, q db.Querier, ids []string, byID map[string]*models.Flag) error {
	rows, err := q.Query(ctx, `
		SELECT flag_id::text, user_id, kind
		FROM flag_overrides
		WHERE flag_id = ANY($1::text[]::uuid[])
		ORDER BY user_id COLLATE "C"`, ids)
	if err != nil {
		return fmt.Errorf("querying overrides: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var flagID, userID, kind string
		if err := rows.Scan(&flagID, &userID, &kind); err != nil {
			return fmt.Errorf("scanning override: %w", err)
		}
		f := byID[flagID]
		if f == nil {
			continue
		}
		if kind == "include" {
			f.Overrides.Include = append(f.Overrides.Include, userID)
		} else {
			f.Overrides.Exclude = append(f.Overrides.Exclude, userID)
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("reading overrides: %w", err)
	}
	return nil
}

// insertFlag creates a flag and its default guardrail row, returning the flag ID.
// Returns ErrAlreadyExists when the key is taken.
func insertFlag(ctx context.Context, q db.Querier, key, name, description string) (string, error) {
	var id string
	err := q.QueryRow(ctx, `
		INSERT INTO flags (key, name, description)
		VALUES ($1, $2, $3)
		RETURNING id::text`,
		key, name, description,
	).Scan(&id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			return "", fmt.Errorf("%w: %q", ErrAlreadyExists, key)
		}
		return "", fmt.Errorf("inserting flag: %w", err)
	}

	_, err = q.Exec(ctx, `
		INSERT INTO guardrails (flag_id, canary_error_query, baseline_error_query, canary_samples_query)
		VALUES ($1::text::uuid, $2, $3, $4)`,
		id, defaultCanaryErrorQuery, defaultBaselineErrorQuery, defaultCanarySamplesQuery,
	)
	if err != nil {
		return "", fmt.Errorf("inserting guardrail: %w", err)
	}
	return id, nil
}

// updateFlag writes the flag's editable columns and bumps its version,
// but only if the flag is still at expectedVersion (optimistic check).
// It returns the new version and update time.
func updateFlag(ctx context.Context, q db.Querier, f models.Flag, expectedVersion int) (int, time.Time, error) {
	var version int
	var updatedAt time.Time
	err := q.QueryRow(ctx, `
		UPDATE flags
		SET name = $2, description = $3, enabled = $4, status = $5, rollout_percentage = $6,
		    version = version + 1, updated_at = now()
		WHERE id = $1::text::uuid AND version = $7
		RETURNING version, updated_at`,
		f.ID, f.Name, f.Description, f.Enabled, f.Status, f.RolloutPercentage, expectedVersion,
	).Scan(&version, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, time.Time{}, fmt.Errorf("%w: %q is no longer at version %d", ErrVersionConflict, f.Key, expectedVersion)
	}
	if err != nil {
		return 0, time.Time{}, fmt.Errorf("updating flag %q: %w", f.Key, err)
	}
	return version, updatedAt.UTC(), nil
}

// replaceConditions swaps a flag's conditions for conds, keeping their order.
func replaceConditions(ctx context.Context, q db.Querier, flagID string, conds []models.Condition) error {
	if _, err := q.Exec(ctx, `DELETE FROM targeting_conditions WHERE flag_id = $1::text::uuid`, flagID); err != nil {
		return fmt.Errorf("deleting conditions: %w", err)
	}
	for i, c := range conds {
		values, err := json.Marshal(c.Values)
		if err != nil {
			return fmt.Errorf("encoding condition values: %w", err)
		}
		_, err = q.Exec(ctx, `
			INSERT INTO targeting_conditions (flag_id, sort_order, attribute, operator, match_values)
			VALUES ($1::text::uuid, $2, $3, $4, $5)`,
			flagID, i, c.Attribute, c.Operator, values,
		)
		if err != nil {
			return fmt.Errorf("inserting condition: %w", err)
		}
	}
	return nil
}

// replaceOverrides swaps a flag's include and exclude lists.
func replaceOverrides(ctx context.Context, q db.Querier, flagID string, o models.Overrides) error {
	if _, err := q.Exec(ctx, `DELETE FROM flag_overrides WHERE flag_id = $1::text::uuid`, flagID); err != nil {
		return fmt.Errorf("deleting overrides: %w", err)
	}
	insert := func(kind string, userIDs []string) error {
		for _, userID := range userIDs {
			_, err := q.Exec(ctx, `
				INSERT INTO flag_overrides (flag_id, user_id, kind)
				VALUES ($1::text::uuid, $2, $3)`,
				flagID, userID, kind,
			)
			if err != nil {
				return fmt.Errorf("inserting %s override: %w", kind, err)
			}
		}
		return nil
	}
	if err := insert("include", o.Include); err != nil {
		return err
	}
	return insert("exclude", o.Exclude)
}

// updateGuardrail writes a flag's editable guardrail settings.
func updateGuardrail(ctx context.Context, q db.Querier, flagID string, g models.Guardrail) error {
	_, err := q.Exec(ctx, `
		UPDATE guardrails
		SET enabled = $2, error_rate_threshold = $3, min_samples = $4, consecutive_breaches = $5
		WHERE flag_id = $1::text::uuid`,
		flagID, g.Enabled, g.ErrorRateThreshold, g.MinSamples, g.ConsecutiveBreaches,
	)
	if err != nil {
		return fmt.Errorf("updating guardrail: %w", err)
	}
	return nil
}
