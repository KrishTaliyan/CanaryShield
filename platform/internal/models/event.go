package models

import "time"

// Event types.
const (
	EventCreated           = "created"
	EventUpdated           = "updated"
	EventConditionsChanged = "conditions_changed"
	EventOverridesChanged  = "overrides_changed"
	EventGuardrailChanged  = "guardrail_changed"
	EventStarted           = "started"
	EventStepChanged       = "step_changed"
	EventPaused            = "paused"
	EventResumed           = "resumed"
	EventCompleted         = "completed"
	EventRolledBack        = "rolled_back"
	EventKilled            = "killed"
)

// Actors.
const (
	ActorAdmin    = "admin"
	ActorGuardian = "system:guardian"
)

// Event is one entry in a flag's rollout history.
type Event struct {
	ID             int64     `json:"id"`
	FlagKey        string    `json:"flagKey"`
	Type           string    `json:"type"`
	FromPercentage *float64  `json:"fromPercentage"`
	ToPercentage   *float64  `json:"toPercentage"`
	Actor          string    `json:"actor"`
	Reason         *string   `json:"reason"`
	CreatedAt      time.Time `json:"createdAt"`
}
