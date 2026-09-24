package models

import "time"

// Incident statuses.
const (
	IncidentOpen     = "open"
	IncidentResolved = "resolved"
)

// Incident records one automatic rollback by the guardian.
type Incident struct {
	ID                string     `json:"id"`
	FlagKey           string     `json:"flagKey"`
	Status            string     `json:"status"`
	ObservedErrorRate float64    `json:"observedErrorRate"`
	BaselineErrorRate *float64   `json:"baselineErrorRate"`
	Threshold         float64    `json:"threshold"`
	ExposedPercentage float64    `json:"exposedPercentage"`
	ExposedUsers      *int       `json:"exposedUsers"`
	SampleSize        int        `json:"sampleSize"`
	Reason            string     `json:"reason"`
	FirstBreachAt     time.Time  `json:"firstBreachAt"`
	RolledBackAt      time.Time  `json:"rolledBackAt"`
	ResolvedAt        *time.Time `json:"resolvedAt"`
}
