// Package flags manages feature flags: CRUD, targeting, guardrails and
// rollout changes.
package flags

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"flagguard/platform/internal/audit"
	"flagguard/platform/internal/evaluation"
	"flagguard/platform/internal/models"
	"flagguard/platform/internal/rollout"
	"flagguard/platform/internal/targeting"
)

// Service errors. Handlers map them to contract error codes.
var (
	ErrNotFound        = errors.New("flag not found")
	ErrAlreadyExists   = errors.New("flag already exists")
	ErrVersionConflict = errors.New("flag version changed")
)

// ValidationError reports invalid input (422 VALIDATION_FAILED).
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string { return e.Message }

var keyPattern = regexp.MustCompile(`^[a-z0-9_]{3,64}$`)

const auditEntityFlag = "flag"

// Cache is the Redis side of a flag: write-through after each commit
// (README 9.4 step 3), health status and the exposure counter.
type Cache interface {
	Store(ctx context.Context, f models.Flag) error
	HealthStatuses(ctx context.Context, flagKeys []string) (map[string]string, error)
	ResetExposure(ctx context.Context, flagKey string) error
}

// Broadcaster sends live events to dashboards (README 9.4 step 4).
type Broadcaster interface {
	PublishFlag(f models.Flag)
	PublishRollout(e models.Event)
}

// Service implements flag use cases on top of PostgreSQL.
type Service struct {
	pool     *pgxpool.Pool
	snapshot *evaluation.Snapshot
	cache    Cache
	events   Broadcaster
}

// NewService returns a flag service backed by pool. After each commit it
// updates snapshot, writes the flag through to cache and broadcasts it.
func NewService(pool *pgxpool.Pool, snapshot *evaluation.Snapshot, cache Cache, events Broadcaster) *Service {
	return &Service{pool: pool, snapshot: snapshot, cache: cache, events: events}
}

// CreateInput is the body of POST /flags.
type CreateInput struct {
	Key         string
	Name        string
	Description string
}

// UpdateInput is the body of PATCH /flags/{key}. Nil fields are left unchanged.
type UpdateInput struct {
	Name        *string
	Description *string
}

// RolloutInput carries the optional parameters of rollout actions:
// Percentage for set, Reason for rollback.
type RolloutInput struct {
	Percentage float64
	Reason     string
}

// GuardrailInput is the body of PUT /flags/{key}/guardrail.
type GuardrailInput struct {
	Enabled             bool
	ErrorRateThreshold  float64
	MinSamples          int
	ConsecutiveBreaches int
}

// change describes the event a flag mutation records.
type change struct {
	eventType     string
	from          *float64
	to            *float64
	reason        *string
	resetExposure bool
}

// mutateOptions says who is changing a flag and, for the guardian, which
// version it expects (0 means any).
type mutateOptions struct {
	actor           string
	expectedVersion int
}

var byAdmin = mutateOptions{actor: models.ActorAdmin}

// List returns every flag.
func (s *Service) List(ctx context.Context) ([]models.Flag, error) {
	list, err := listFlags(ctx, s.pool)
	if err != nil {
		return nil, err
	}
	ptrs := make([]*models.Flag, len(list))
	for i := range list {
		ptrs[i] = &list[i]
	}
	s.decorate(ctx, ptrs...)
	return list, nil
}

// Get returns one flag by key.
func (s *Service) Get(ctx context.Context, key string) (models.Flag, error) {
	f, err := getFlag(ctx, s.pool, key, false)
	if err != nil {
		return models.Flag{}, err
	}
	s.decorate(ctx, &f)
	return f, nil
}

// Create validates and stores a new draft flag with its default guardrail,
// a created event and an audit row, all in one transaction.
func (s *Service) Create(ctx context.Context, in CreateInput) (models.Flag, error) {
	if !keyPattern.MatchString(in.Key) {
		return models.Flag{}, &ValidationError{Message: "key must match ^[a-z0-9_]{3,64}$"}
	}
	name, err := validateName(in.Name)
	if err != nil {
		return models.Flag{}, err
	}

	var created models.Flag
	var event models.Event
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		id, err := insertFlag(ctx, tx, in.Key, name, in.Description)
		if err != nil {
			return err
		}
		f, err := getFlag(ctx, tx, in.Key, false)
		if err != nil {
			return err
		}
		f.HealthStatus = models.HealthNotMonitored

		if event, err = audit.InsertEvent(ctx, tx, audit.NewEvent{
			FlagID: id, FlagKey: f.Key, Type: models.EventCreated, Actor: models.ActorAdmin,
		}); err != nil {
			return err
		}
		if err := audit.InsertAuditLog(ctx, tx, audit.Entry{
			Actor: models.ActorAdmin, Action: models.EventCreated,
			EntityType: auditEntityFlag, EntityID: f.Key, After: f,
		}); err != nil {
			return err
		}
		created = f
		return nil
	})
	if err != nil {
		return models.Flag{}, err
	}
	s.publish(ctx, created, event)
	return created, nil
}

// Update changes a flag's name and/or description. An empty update returns
// the flag unchanged without writing anything.
func (s *Service) Update(ctx context.Context, key string, in UpdateInput) (models.Flag, error) {
	if in.Name == nil && in.Description == nil {
		return s.Get(ctx, key)
	}
	var name string
	if in.Name != nil {
		var err error
		if name, err = validateName(*in.Name); err != nil {
			return models.Flag{}, err
		}
	}

	return s.mutate(ctx, key, byAdmin, func(_ context.Context, _ pgx.Tx, f *models.Flag) (change, error) {
		if in.Name != nil {
			f.Name = name
		}
		if in.Description != nil {
			f.Description = *in.Description
		}
		return change{eventType: models.EventUpdated}, nil
	})
}

// SetConditions replaces a flag's targeting conditions.
func (s *Service) SetConditions(ctx context.Context, key string, conditions []models.Condition) (models.Flag, error) {
	conds := make([]models.Condition, len(conditions))
	for i, c := range conditions {
		c.Attribute = strings.TrimSpace(c.Attribute)
		if c.Values == nil {
			c.Values = []any{}
		}
		if err := targeting.ValidateCondition(c); err != nil {
			return models.Flag{}, &ValidationError{Message: fmt.Sprintf("conditions[%d]: %v", i, err)}
		}
		conds[i] = c
	}

	return s.mutate(ctx, key, byAdmin, func(ctx context.Context, tx pgx.Tx, f *models.Flag) (change, error) {
		if err := replaceConditions(ctx, tx, f.ID, conds); err != nil {
			return change{}, err
		}
		f.Conditions = conds
		return change{eventType: models.EventConditionsChanged}, nil
	})
}

// SetOverrides replaces a flag's include and exclude lists.
func (s *Service) SetOverrides(ctx context.Context, key string, include, exclude []string) (models.Flag, error) {
	inc, err := normalizeUserIDs("include", include)
	if err != nil {
		return models.Flag{}, err
	}
	exc, err := normalizeUserIDs("exclude", exclude)
	if err != nil {
		return models.Flag{}, err
	}
	for _, id := range inc {
		if slices.Contains(exc, id) {
			return models.Flag{}, &ValidationError{Message: fmt.Sprintf("user %q cannot be in both include and exclude", id)}
		}
	}
	overrides := models.Overrides{Include: inc, Exclude: exc}

	return s.mutate(ctx, key, byAdmin, func(ctx context.Context, tx pgx.Tx, f *models.Flag) (change, error) {
		if err := replaceOverrides(ctx, tx, f.ID, overrides); err != nil {
			return change{}, err
		}
		f.Overrides = overrides
		return change{eventType: models.EventOverridesChanged}, nil
	})
}

// SetGuardrail updates a flag's automatic-rollback settings. The PromQL
// queries are not editable and stay unchanged.
func (s *Service) SetGuardrail(ctx context.Context, key string, in GuardrailInput) (models.Flag, error) {
	// NUMERIC(6,4) stores four decimals.
	threshold := math.Round(in.ErrorRateThreshold*10000) / 10000
	switch {
	case threshold <= 0 || threshold >= 1:
		return models.Flag{}, &ValidationError{Message: "errorRateThreshold must be greater than 0 and less than 1"}
	case in.MinSamples < 1 || in.MinSamples > 10000:
		return models.Flag{}, &ValidationError{Message: "minSamples must be between 1 and 10000"}
	case in.ConsecutiveBreaches < 1 || in.ConsecutiveBreaches > 10:
		return models.Flag{}, &ValidationError{Message: "consecutiveBreaches must be between 1 and 10"}
	}

	return s.mutate(ctx, key, byAdmin, func(ctx context.Context, tx pgx.Tx, f *models.Flag) (change, error) {
		f.Guardrail.Enabled = in.Enabled
		f.Guardrail.ErrorRateThreshold = threshold
		f.Guardrail.MinSamples = in.MinSamples
		f.Guardrail.ConsecutiveBreaches = in.ConsecutiveBreaches
		if err := updateGuardrail(ctx, tx, f.ID, f.Guardrail); err != nil {
			return change{}, err
		}
		return change{eventType: models.EventGuardrailChanged}, nil
	})
}

// Rollout applies a rollout action per README 9.4. Start also resets the
// flag's exposure counter.
func (s *Service) Rollout(ctx context.Context, key string, action rollout.Action, in RolloutInput) (models.Flag, error) {
	var pct float64
	if action == rollout.ActionSet {
		// NUMERIC(5,2) stores two decimals, matching the 0.01% bucket granularity.
		pct = math.Round(in.Percentage*100) / 100
		if pct <= 0 || pct > 100 {
			return models.Flag{}, &ValidationError{Message: "percentage must be greater than 0 and at most 100"}
		}
	}
	var reason *string
	if r := strings.TrimSpace(in.Reason); action == rollout.ActionRollback && r != "" {
		reason = &r
	}

	return s.mutate(ctx, key, byAdmin, func(_ context.Context, _ pgx.Tx, f *models.Flag) (change, error) {
		ch, err := applyRollout(f, action, pct)
		ch.reason = reason
		ch.resetExposure = action == rollout.ActionStart
		return ch, err
	})
}

// GuardianRollback rolls a flag back to 0% for the guardian (README 9.5
// step 4). It fails with ErrVersionConflict unless the flag is still at
// version. record runs in the same transaction with the flag as it was
// before the rollback, so the guardian can insert its incident atomically.
func (s *Service) GuardianRollback(ctx context.Context, key string, version int, reason string,
	record func(ctx context.Context, tx pgx.Tx, before models.Flag) error) (models.Flag, error) {
	opts := mutateOptions{actor: models.ActorGuardian, expectedVersion: version}
	return s.mutate(ctx, key, opts, func(ctx context.Context, tx pgx.Tx, f *models.Flag) (change, error) {
		before := *f
		ch, err := applyRollout(f, rollout.ActionRollback, 0)
		if err != nil {
			return change{}, err
		}
		if err := record(ctx, tx, before); err != nil {
			return change{}, err
		}
		ch.reason = &reason
		return ch, nil
	})
}

// ListEvents returns up to limit events for a flag, newest first.
func (s *Service) ListEvents(ctx context.Context, key string, limit int) ([]models.Event, error) {
	if _, err := getFlag(ctx, s.pool, key, false); err != nil {
		return nil, err
	}
	return audit.ListEvents(ctx, s.pool, key, limit)
}

// applyRollout moves f through the rollout state machine and describes the
// resulting event.
func applyRollout(f *models.Flag, action rollout.Action, pct float64) (change, error) {
	cur := rollout.State{Enabled: f.Enabled, Status: f.Status, Percentage: f.RolloutPercentage}
	out, err := rollout.Apply(action, cur, f.RolloutSteps, pct)
	if err != nil {
		return change{}, err
	}
	from, to := f.RolloutPercentage, out.Percentage
	f.Enabled, f.Status, f.RolloutPercentage = out.Enabled, out.Status, out.Percentage
	return change{eventType: out.EventType, from: &from, to: &to}, nil
}

// mutate runs one flag change in a single transaction (README 9.4 step 1):
// lock the flag, apply the change, bump version, and insert exactly one
// rollout event and one audit row. After the commit it publishes the flag.
func (s *Service) mutate(ctx context.Context, key string, opts mutateOptions,
	apply func(ctx context.Context, tx pgx.Tx, f *models.Flag) (change, error)) (models.Flag, error) {
	health := s.healthStatus(ctx, key)

	var after models.Flag
	var event models.Event
	var ch change
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		before, err := getFlag(ctx, tx, key, true)
		if err != nil {
			return err
		}
		if opts.expectedVersion != 0 && before.Version != opts.expectedVersion {
			return fmt.Errorf("%w: %q is at version %d, expected %d",
				ErrVersionConflict, key, before.Version, opts.expectedVersion)
		}
		before.HealthStatus = health

		next := before
		if ch, err = apply(ctx, tx, &next); err != nil {
			return err
		}
		if next.Version, next.UpdatedAt, err = updateFlag(ctx, tx, next, before.Version); err != nil {
			return err
		}

		if event, err = audit.InsertEvent(ctx, tx, audit.NewEvent{
			FlagID: next.ID, FlagKey: next.Key, Type: ch.eventType,
			FromPercentage: ch.from, ToPercentage: ch.to,
			Actor: opts.actor, Reason: ch.reason,
		}); err != nil {
			return err
		}
		if err := audit.InsertAuditLog(ctx, tx, audit.Entry{
			Actor: opts.actor, Action: ch.eventType,
			EntityType: auditEntityFlag, EntityID: next.Key, Before: before, After: next,
		}); err != nil {
			return err
		}
		after = next
		return nil
	})
	if err != nil {
		return models.Flag{}, err
	}

	if ch.resetExposure {
		if err := s.cache.ResetExposure(context.WithoutCancel(ctx), key); err != nil {
			slog.Warn("resetting exposure counter failed", "flag", key, "error", err)
		}
	}
	s.publish(ctx, after, event)
	return after, nil
}

// publish runs README 9.4 steps 2–4 after a commit: update the in-memory
// snapshot, write through to Redis, then broadcast the flag and its event.
// A Redis failure is only logged; PostgreSQL stays the source of truth and
// the reconciler repairs Redis.
func (s *Service) publish(ctx context.Context, f models.Flag, event models.Event) {
	s.snapshot.Set(f)
	if err := s.cache.Store(context.WithoutCancel(ctx), f); err != nil {
		slog.Warn("redis write-through failed; evaluation keeps using the in-memory snapshot",
			"flag", f.Key, "version", f.Version, "error", err)
	}
	s.events.PublishFlag(f)
	s.events.PublishRollout(event)
}

// decorate fills healthStatus from the guardian's Redis health records.
// Flags without a record, or all flags when Redis is down, are NOT_MONITORED.
func (s *Service) decorate(ctx context.Context, list ...*models.Flag) {
	keys := make([]string, len(list))
	for i, f := range list {
		keys[i] = f.Key
	}
	statuses, err := s.cache.HealthStatuses(ctx, keys)
	if err != nil {
		slog.Warn("reading health statuses failed; reporting NOT_MONITORED", "error", err)
	}
	for _, f := range list {
		f.HealthStatus = models.HealthNotMonitored
		if status, ok := statuses[f.Key]; ok {
			f.HealthStatus = status
		}
	}
}

func (s *Service) healthStatus(ctx context.Context, key string) string {
	f := models.Flag{Key: key}
	s.decorate(ctx, &f)
	return f.HealthStatus
}

func validateName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if n := utf8.RuneCountInString(name); n < 1 || n > 100 {
		return "", &ValidationError{Message: "name must be 1 to 100 characters"}
	}
	return name, nil
}

// normalizeUserIDs trims, de-duplicates and sorts user IDs, rejecting blanks.
// The result is sorted to match the order the repository reads them back in.
func normalizeUserIDs(field string, ids []string) ([]string, error) {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			return nil, &ValidationError{Message: field + " cannot contain empty user IDs"}
		}
		if !slices.Contains(out, id) {
			out = append(out, id)
		}
	}
	slices.Sort(out)
	return out, nil
}
