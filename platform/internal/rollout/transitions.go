// Package rollout holds the rollout state machine (README 9.4).
package rollout

import (
	"fmt"
	"strings"

	"flagguard/platform/internal/models"
)

// Action is an admin rollout action.
type Action string

// Rollout actions.
const (
	ActionStart    Action = "start"
	ActionAdvance  Action = "advance"
	ActionSet      Action = "set"
	ActionPause    Action = "pause"
	ActionResume   Action = "resume"
	ActionRollback Action = "rollback"
	ActionKill     Action = "kill"
)

// State is the part of a flag that rollout actions change.
type State struct {
	Enabled    bool
	Status     string
	Percentage float64
}

// Outcome is the new state after an action plus the event type to record.
type Outcome struct {
	State
	EventType string
}

// TransitionError reports an action that README 9.4 does not allow.
type TransitionError struct {
	Message string
}

func (e *TransitionError) Error() string { return e.Message }

func notAllowed(action Action, status string) error {
	return &TransitionError{
		Message: fmt.Sprintf("cannot %s a %s flag", action, strings.ReplaceAll(status, "_", " ")),
	}
}

// Apply returns the state that results from applying action to cur.
// steps are the flag's rollout steps in ascending order; percentage is used
// only by ActionSet and must already be validated (0 < percentage <= 100).
func Apply(action Action, cur State, steps []float64, percentage float64) (Outcome, error) {
	switch action {
	case ActionStart:
		if cur.Status != models.StatusDraft && cur.Status != models.StatusRolledBack {
			return Outcome{}, notAllowed(action, cur.Status)
		}
		if len(steps) == 0 {
			return Outcome{}, &TransitionError{Message: "flag has no rollout steps"}
		}
		return Outcome{
			State:     State{Enabled: true, Status: models.StatusRollingOut, Percentage: steps[0]},
			EventType: models.EventStarted,
		}, nil

	case ActionAdvance:
		if cur.Status != models.StatusRollingOut {
			return Outcome{}, notAllowed(action, cur.Status)
		}
		next, ok := nextStep(steps, cur.Percentage)
		if !ok {
			return Outcome{}, &TransitionError{
				Message: fmt.Sprintf("no rollout step above %g%%", cur.Percentage),
			}
		}
		return changePercentage(cur, next), nil

	case ActionSet:
		if cur.Status != models.StatusRollingOut && cur.Status != models.StatusPaused {
			return Outcome{}, notAllowed(action, cur.Status)
		}
		return changePercentage(cur, percentage), nil

	case ActionPause:
		if cur.Status != models.StatusRollingOut {
			return Outcome{}, notAllowed(action, cur.Status)
		}
		cur.Status = models.StatusPaused
		return Outcome{State: cur, EventType: models.EventPaused}, nil

	case ActionResume:
		if cur.Status != models.StatusPaused {
			return Outcome{}, notAllowed(action, cur.Status)
		}
		cur.Status = models.StatusRollingOut
		return Outcome{State: cur, EventType: models.EventResumed}, nil

	case ActionRollback:
		switch cur.Status {
		case models.StatusRollingOut, models.StatusPaused, models.StatusCompleted:
		default:
			return Outcome{}, notAllowed(action, cur.Status)
		}
		cur.Status = models.StatusRolledBack
		cur.Percentage = 0
		return Outcome{State: cur, EventType: models.EventRolledBack}, nil

	case ActionKill:
		return Outcome{
			State:     State{Enabled: false, Status: models.StatusRolledBack, Percentage: 0},
			EventType: models.EventKilled,
		}, nil
	}
	return Outcome{}, &TransitionError{Message: fmt.Sprintf("unknown action %q", action)}
}

// changePercentage moves to pct, completing the rollout when it reaches 100.
func changePercentage(cur State, pct float64) Outcome {
	cur.Percentage = pct
	if pct >= 100 {
		cur.Status = models.StatusCompleted
		return Outcome{State: cur, EventType: models.EventCompleted}
	}
	return Outcome{State: cur, EventType: models.EventStepChanged}
}

// nextStep returns the first step strictly above current.
func nextStep(steps []float64, current float64) (float64, bool) {
	for _, s := range steps {
		if s > current {
			return s, true
		}
	}
	return 0, false
}
