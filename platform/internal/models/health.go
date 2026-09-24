package models

import "time"

// Health is the guardian's latest verdict for a flag. Rates are nil when
// there is no data; for NOT_MONITORED, rates and CheckedAt are nil and
// Samples and BreachCount are 0.
type Health struct {
	FlagKey           string     `json:"flagKey"`
	Status            string     `json:"status"`
	CanaryErrorRate   *float64   `json:"canaryErrorRate"`
	BaselineErrorRate *float64   `json:"baselineErrorRate"`
	Samples           int        `json:"samples"`
	BreachCount       int        `json:"breachCount"`
	Threshold         float64    `json:"threshold"`
	CheckedAt         *time.Time `json:"checkedAt"`
}
