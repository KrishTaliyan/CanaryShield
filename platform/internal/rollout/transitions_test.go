package rollout

import (
	"errors"
	"slices"
	"testing"

	"flagguard/platform/internal/models"
)

var defaultSteps = []float64{5, 10, 25, 50, 100}

// stateFor returns a realistic state for each status.
func stateFor(status string) State {
	switch status {
	case models.StatusDraft:
		return State{Enabled: false, Status: status, Percentage: 0}
	case models.StatusRollingOut, models.StatusPaused:
		return State{Enabled: true, Status: status, Percentage: 10}
	case models.StatusCompleted:
		return State{Enabled: true, Status: status, Percentage: 100}
	case models.StatusRolledBack:
		return State{Enabled: true, Status: status, Percentage: 0}
	}
	panic("unknown status " + status)
}

// TestTransitionMatrix checks every action against every status: allowed
// pairs must succeed and every other pair must fail with a TransitionError.
func TestTransitionMatrix(t *testing.T) {
	statuses := []string{
		models.StatusDraft, models.StatusRollingOut, models.StatusPaused,
		models.StatusCompleted, models.StatusRolledBack,
	}
	allowed := map[Action][]string{
		ActionStart:    {models.StatusDraft, models.StatusRolledBack},
		ActionAdvance:  {models.StatusRollingOut},
		ActionSet:      {models.StatusRollingOut, models.StatusPaused},
		ActionPause:    {models.StatusRollingOut},
		ActionResume:   {models.StatusPaused},
		ActionRollback: {models.StatusRollingOut, models.StatusPaused, models.StatusCompleted},
		ActionKill:     statuses,
	}

	for action, from := range allowed {
		for _, status := range statuses {
			want := slices.Contains(from, status)
			t.Run(string(action)+"/"+status, func(t *testing.T) {
				_, err := Apply(action, stateFor(status), defaultSteps, 25)
				if want && err != nil {
					t.Fatalf("expected %s from %s to be allowed, got %v", action, status, err)
				}
				if !want {
					var te *TransitionError
					if !errors.As(err, &te) {
						t.Fatalf("expected TransitionError for %s from %s, got %v", action, status, err)
					}
				}
			})
		}
	}
}

func TestTransitionOutcomes(t *testing.T) {
	tests := []struct {
		name   string
		action Action
		from   State
		steps  []float64
		pct    float64
		want   Outcome
	}{
		{
			name: "start from draft uses the first step", action: ActionStart,
			from: State{Enabled: false, Status: models.StatusDraft, Percentage: 0}, steps: defaultSteps,
			want: Outcome{State{true, models.StatusRollingOut, 5}, models.EventStarted},
		},
		{
			name: "start from rolled_back re-enables", action: ActionStart,
			from: State{Enabled: false, Status: models.StatusRolledBack, Percentage: 0}, steps: defaultSteps,
			want: Outcome{State{true, models.StatusRollingOut, 5}, models.EventStarted},
		},
		{
			name: "advance moves to the next step", action: ActionAdvance,
			from: State{true, models.StatusRollingOut, 10}, steps: defaultSteps,
			want: Outcome{State{true, models.StatusRollingOut, 25}, models.EventStepChanged},
		},
		{
			name: "advance from an off-step value goes to the next step above it", action: ActionAdvance,
			from: State{true, models.StatusRollingOut, 30}, steps: defaultSteps,
			want: Outcome{State{true, models.StatusRollingOut, 50}, models.EventStepChanged},
		},
		{
			name: "advance to 100 completes", action: ActionAdvance,
			from: State{true, models.StatusRollingOut, 50}, steps: defaultSteps,
			want: Outcome{State{true, models.StatusCompleted, 100}, models.EventCompleted},
		},
		{
			name: "set keeps rolling_out", action: ActionSet, pct: 25,
			from: State{true, models.StatusRollingOut, 5}, steps: defaultSteps,
			want: Outcome{State{true, models.StatusRollingOut, 25}, models.EventStepChanged},
		},
		{
			name: "set keeps paused", action: ActionSet, pct: 12.5,
			from: State{true, models.StatusPaused, 5}, steps: defaultSteps,
			want: Outcome{State{true, models.StatusPaused, 12.5}, models.EventStepChanged},
		},
		{
			name: "set can lower the percentage", action: ActionSet, pct: 5,
			from: State{true, models.StatusRollingOut, 25}, steps: defaultSteps,
			want: Outcome{State{true, models.StatusRollingOut, 5}, models.EventStepChanged},
		},
		{
			name: "set 100 completes", action: ActionSet, pct: 100,
			from: State{true, models.StatusPaused, 25}, steps: defaultSteps,
			want: Outcome{State{true, models.StatusCompleted, 100}, models.EventCompleted},
		},
		{
			name: "pause freezes the percentage", action: ActionPause,
			from: State{true, models.StatusRollingOut, 25}, steps: defaultSteps,
			want: Outcome{State{true, models.StatusPaused, 25}, models.EventPaused},
		},
		{
			name: "resume keeps the percentage", action: ActionResume,
			from: State{true, models.StatusPaused, 25}, steps: defaultSteps,
			want: Outcome{State{true, models.StatusRollingOut, 25}, models.EventResumed},
		},
		{
			name: "rollback goes to 0 and stays enabled", action: ActionRollback,
			from: State{true, models.StatusCompleted, 100}, steps: defaultSteps,
			want: Outcome{State{true, models.StatusRolledBack, 0}, models.EventRolledBack},
		},
		{
			name: "kill disables from rolling_out", action: ActionKill,
			from: State{true, models.StatusRollingOut, 25}, steps: defaultSteps,
			want: Outcome{State{false, models.StatusRolledBack, 0}, models.EventKilled},
		},
		{
			name: "kill disables from draft", action: ActionKill,
			from: State{false, models.StatusDraft, 0}, steps: defaultSteps,
			want: Outcome{State{false, models.StatusRolledBack, 0}, models.EventKilled},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := Apply(tc.action, tc.from, tc.steps, tc.pct)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("got %+v, want %+v", got, tc.want)
			}
		})
	}
}

func TestTransitionEdgeErrors(t *testing.T) {
	tests := []struct {
		name   string
		action Action
		from   State
		steps  []float64
	}{
		{"advance with no step above current", ActionAdvance, State{true, models.StatusRollingOut, 50}, []float64{5, 10, 25, 50}},
		{"start with no steps", ActionStart, State{false, models.StatusDraft, 0}, nil},
		{"unknown action", Action("explode"), State{true, models.StatusRollingOut, 5}, defaultSteps},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := Apply(tc.action, tc.from, tc.steps, 0)
			var te *TransitionError
			if !errors.As(err, &te) {
				t.Fatalf("expected TransitionError, got %v", err)
			}
		})
	}
}

func TestTransitionErrorMessage(t *testing.T) {
	_, err := Apply(ActionAdvance, State{true, models.StatusPaused, 10}, defaultSteps, 0)
	if err == nil || err.Error() != "cannot advance a paused flag" {
		t.Fatalf("got %v, want %q", err, "cannot advance a paused flag")
	}
}
