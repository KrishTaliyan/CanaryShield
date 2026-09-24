package audit

import (
	"context"
	"encoding/json"
	"fmt"

	"flagguard/platform/internal/db"
)

// Entry describes an audit_logs row. Before and After are stored as JSON;
// nil means NULL.
type Entry struct {
	Actor      string
	Action     string
	EntityType string
	EntityID   string
	Before     any
	After      any
}

// InsertAuditLog writes one audit log row.
func InsertAuditLog(ctx context.Context, q db.Querier, e Entry) error {
	before, err := toJSON(e.Before)
	if err != nil {
		return fmt.Errorf("encoding audit before state: %w", err)
	}
	after, err := toJSON(e.After)
	if err != nil {
		return fmt.Errorf("encoding audit after state: %w", err)
	}

	_, err = q.Exec(ctx, `
		INSERT INTO audit_logs (actor, action, entity_type, entity_id, before_state, after_state)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		e.Actor, e.Action, e.EntityType, e.EntityID, before, after,
	)
	if err != nil {
		return fmt.Errorf("inserting audit log: %w", err)
	}
	return nil
}

func toJSON(v any) ([]byte, error) {
	if v == nil {
		return nil, nil
	}
	return json.Marshal(v)
}
