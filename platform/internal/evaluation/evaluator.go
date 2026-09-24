// Package evaluation decides which variant a user gets (README 9.1). It
// reads only the in-memory snapshot, never PostgreSQL or Redis.
package evaluation

import (
	"slices"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"flagguard/platform/internal/models"
	"flagguard/platform/internal/rollout"
	"flagguard/platform/internal/targeting"
)

var evaluationsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "ff_evaluations_total",
	Help: "SDK flag evaluations by flag, variant and reason.",
}, []string{"flag", "variant", "reason"})

// Result is the EvaluationResult object from README 8.2.
type Result struct {
	FlagKey           string  `json:"flagKey"`
	Variant           string  `json:"variant"`
	Reason            string  `json:"reason"`
	Bucket            int     `json:"bucket"`
	RolloutPercentage float64 `json:"rolloutPercentage"`
	FlagVersion       int     `json:"flagVersion"`
}

// Evaluator evaluates flags against the snapshot.
type Evaluator struct {
	snapshot *Snapshot
}

// NewEvaluator returns an evaluator reading from snapshot.
func NewEvaluator(snapshot *Snapshot) *Evaluator {
	return &Evaluator{snapshot: snapshot}
}

// Evaluate serves an SDK request and counts it in ff_evaluations_total.
func (e *Evaluator) Evaluate(flagKey string, ctx map[string]any) Result {
	r := e.Preview(flagKey, ctx)
	evaluationsTotal.WithLabelValues(r.FlagKey, r.Variant, r.Reason).Inc()
	return r
}

// Preview evaluates without side effects, for the admin playground.
func (e *Evaluator) Preview(flagKey string, ctx map[string]any) Result {
	f, _ := e.snapshot.Get(flagKey)
	return evaluate(f, flagKey, ctx)
}

// evaluate applies README 9.1 in order; the first match wins. When in doubt
// it serves the control variant.
func evaluate(f *models.Flag, flagKey string, ctx map[string]any) Result {
	if f == nil {
		return Result{FlagKey: flagKey, Variant: VariantOff, Reason: ReasonFlagNotFound, Bucket: NoBucket}
	}

	control := func(reason string) Result { return result(f, f.ControlVariant, reason, NoBucket) }
	userID, hasUserID := ctx["userId"].(string)
	hasUserID = hasUserID && userID != ""

	switch {
	case f.Status == models.StatusDraft:
		return control(ReasonNotStarted)
	case !f.Enabled:
		return control(ReasonKillSwitch)
	case f.Status == models.StatusRolledBack:
		return control(ReasonRolledBack)
	case hasUserID && slices.Contains(f.Overrides.Exclude, userID):
		return control(ReasonOverrideExclude)
	case hasUserID && slices.Contains(f.Overrides.Include, userID):
		return result(f, f.TreatmentVariant, ReasonOverrideInclude, NoBucket)
	case !targeting.Matches(f.Conditions, ctx):
		return control(ReasonNotEligible)
	case !hasUserID:
		return control(ReasonNoBucketKey)
	}

	bucket := rollout.Bucket(f.Key, f.Salt, userID)
	if rollout.InRollout(bucket, f.RolloutPercentage) {
		return result(f, f.TreatmentVariant, ReasonInRollout, bucket)
	}
	return result(f, f.ControlVariant, ReasonOutsideRollout, bucket)
}

func result(f *models.Flag, variant, reason string, bucket int) Result {
	return Result{
		FlagKey:           f.Key,
		Variant:           variant,
		Reason:            reason,
		Bucket:            bucket,
		RolloutPercentage: f.RolloutPercentage,
		FlagVersion:       f.Version,
	}
}
