// Package audit records rollout events and audit log rows.
package audit

import (
	"context"
	"fmt"

	"flagguard/platform/internal/db"
	"flagguard/platform/internal/models"
)

// NewEvent describes a rollout_events row to insert.
type NewEvent struct {
	FlagID         string
	FlagKey        string
	Type           string
	FromPercentage *float64
	ToPercentage   *float64
	Actor          string
	Reason         *string
}

// InsertEvent writes one rollout event and returns it as stored.
func InsertEvent(ctx context.Context, q db.Querier, e NewEvent) (models.Event, error) {
	ev := models.Event{
		FlagKey:        e.FlagKey,
		Type:           e.Type,
		FromPercentage: e.FromPercentage,
		ToPercentage:   e.ToPercentage,
		Actor:          e.Actor,
		Reason:         e.Reason,
	}
	err := q.QueryRow(ctx, `
		INSERT INTO rollout_events (flag_id, event_type, from_percentage, to_percentage, actor, reason)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at`,
		e.FlagID, e.Type, e.FromPercentage, e.ToPercentage, e.Actor, e.Reason,
	).Scan(&ev.ID, &ev.CreatedAt)
	if err != nil {
		return models.Event{}, fmt.Errorf("inserting %s event: %w", e.Type, err)
	}
	ev.CreatedAt = ev.CreatedAt.UTC()
	return ev, nil
}

// ListEvents returns up to limit events for a flag, newest first.
func ListEvents(ctx context.Context, q db.Querier, flagKey string, limit int) ([]models.Event, error) {
	rows, err := q.Query(ctx, `
		SELECT e.id, f.key, e.event_type, e.from_percentage, e.to_percentage, e.actor, e.reason, e.created_at
		FROM rollout_events e
		JOIN flags f ON f.id = e.flag_id
		WHERE f.key = $1
		ORDER BY e.created_at DESC, e.id DESC
		LIMIT $2`,
		flagKey, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("querying events: %w", err)
	}
	defer rows.Close()

	events := []models.Event{}
	for rows.Next() {
		var ev models.Event
		if err := rows.Scan(&ev.ID, &ev.FlagKey, &ev.Type, &ev.FromPercentage, &ev.ToPercentage,
			&ev.Actor, &ev.Reason, &ev.CreatedAt); err != nil {
			return nil, fmt.Errorf("scanning event: %w", err)
		}
		ev.CreatedAt = ev.CreatedAt.UTC()
		events = append(events, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reading events: %w", err)
	}
	return events, nil
}
