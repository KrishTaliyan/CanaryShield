// Package models holds the platform's domain types. JSON tags match the
// frozen API contract in README section 8.2.
package models

import "time"

// Flag statuses.
const (
	StatusDraft      = "draft"
	StatusRollingOut = "rolling_out"
	StatusPaused     = "paused"
	StatusCompleted  = "completed"
	StatusRolledBack = "rolled_back"
)

// Health statuses, used by Flag.HealthStatus.
const (
	HealthHealthy          = "HEALTHY"
	HealthWarning          = "WARNING"
	HealthBreached         = "BREACHED"
	HealthInsufficientData = "INSUFFICIENT_DATA"
	HealthNotMonitored     = "NOT_MONITORED"
)

// Flag is a feature flag with its rollout, targeting and guardrail settings.
type Flag struct {
	ID                string      `json:"-"`
	Key               string      `json:"key"`
	Name              string      `json:"name"`
	Description       string      `json:"description"`
	Enabled           bool        `json:"enabled"`
	Status            string      `json:"status"`
	ControlVariant    string      `json:"controlVariant"`
	TreatmentVariant  string      `json:"treatmentVariant"`
	Salt              string      `json:"-"`
	RolloutPercentage float64     `json:"rolloutPercentage"`
	RolloutSteps      []float64   `json:"rolloutSteps"`
	Conditions        []Condition `json:"conditions"`
	Overrides         Overrides   `json:"overrides"`
	Guardrail         Guardrail   `json:"guardrail"`
	HealthStatus      string      `json:"healthStatus"`
	Version           int         `json:"version"`
	CreatedAt         time.Time   `json:"createdAt"`
	UpdatedAt         time.Time   `json:"updatedAt"`
}

// Condition is one targeting rule. Values is always an array.
type Condition struct {
	Attribute string `json:"attribute"`
	Operator  string `json:"operator"`
	Values    []any  `json:"values"`
}

// Overrides force specific users into (include) or out of (exclude) the treatment.
type Overrides struct {
	Include []string `json:"include"`
	Exclude []string `json:"exclude"`
}

// Guardrail configures automatic rollback. The PromQL queries are internal.
type Guardrail struct {
	Enabled             bool    `json:"enabled"`
	ErrorRateThreshold  float64 `json:"errorRateThreshold"`
	MinSamples          int     `json:"minSamples"`
	ConsecutiveBreaches int     `json:"consecutiveBreaches"`
	CanaryErrorQuery    string  `json:"-"`
	BaselineErrorQuery  string  `json:"-"`
	CanarySamplesQuery  string  `json:"-"`
}
