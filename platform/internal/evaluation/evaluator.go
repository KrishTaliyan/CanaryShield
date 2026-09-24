// Package evaluation decides which variant a user gets (README 9.1). It
// reads only the in-memory snapshot, never PostgreSQL or Redis.
package evaluation

import (
	"context"
	"log/slog"
	"slices"
	"time"

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

// Exposure tracking settings.
const (
	exposureQueueSize  = 10000
	exposureFlushEvery = 500 * time.Millisecond
	exposureWarnEvery  = 30 * time.Second
)

// ExposureStore records the users who were served a flag's treatment.
type ExposureStore interface {
	AddExposures(ctx context.Context, flagKey string, userIDs []string) error
}

type exposure struct {
	flagKey string
	userID  string
}

// Evaluator evaluates flags against the snapshot.
type Evaluator struct {
	snapshot  *Snapshot
	exposures chan exposure
}

// NewEvaluator returns an evaluator reading from snapshot.
func NewEvaluator(snapshot *Snapshot) *Evaluator {
	return &Evaluator{snapshot: snapshot, exposures: make(chan exposure, exposureQueueSize)}
}

// Evaluate serves an SDK request, counts it in ff_evaluations_total and
// queues an exposure when the treatment is served.
func (e *Evaluator) Evaluate(flagKey string, ctx map[string]any) Result {
	r := e.Preview(flagKey, ctx)
	evaluationsTotal.WithLabelValues(r.FlagKey, r.Variant, r.Reason).Inc()
	if r.Reason == ReasonInRollout || r.Reason == ReasonOverrideInclude {
		userID, _ := ctx["userId"].(string)
		e.trackExposure(r.FlagKey, userID)
	}
	return r
}

// trackExposure queues an exposure without ever blocking the response; when
// the queue is full the exposure is dropped.
func (e *Evaluator) trackExposure(flagKey, userID string) {
	select {
	case e.exposures <- exposure{flagKey: flagKey, userID: userID}:
	default:
	}
}

// RecordExposures writes queued exposures to store in batches until ctx is
// done. Writes are fire-and-forget: a failed batch is logged and dropped.
func (e *Evaluator) RecordExposures(ctx context.Context, store ExposureStore) {
	ticker := time.NewTicker(exposureFlushEvery)
	defer ticker.Stop()

	pending := map[string][]string{}
	var lastWarn time.Time
	flush := func() {
		for flagKey, userIDs := range pending {
			err := store.AddExposures(context.WithoutCancel(ctx), flagKey, userIDs)
			if err != nil && time.Since(lastWarn) > exposureWarnEvery {
				slog.Warn("recording exposures failed; dropping them", "flag", flagKey, "users", len(userIDs), "error", err)
				lastWarn = time.Now()
			}
			delete(pending, flagKey)
		}
	}

	for {
		select {
		case <-ctx.Done():
			flush()
			return
		case x := <-e.exposures:
			pending[x.flagKey] = append(pending[x.flagKey], x.userID)
		case <-ticker.C:
			flush()
		}
	}
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
