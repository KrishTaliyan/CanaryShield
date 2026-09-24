package evaluation

import (
	"testing"

	"flagguard/platform/internal/models"
	"flagguard/platform/internal/rollout"
)

const testSalt = "a1b2c3d4e5f60718"

// baseFlag returns a flag rolling out to pct with no targeting.
func baseFlag(pct float64) models.Flag {
	return models.Flag{
		ID: "11111111-1111-1111-1111-111111111111", Key: "new_payment_flow",
		Enabled: true, Status: models.StatusRollingOut,
		ControlVariant: "old", TreatmentVariant: "new", Salt: testSalt,
		RolloutPercentage: pct, RolloutSteps: []float64{5, 10, 25, 50, 100},
		Conditions: []models.Condition{},
		Overrides:  models.Overrides{Include: []string{}, Exclude: []string{}},
		Version:    7,
	}
}

func flagAt(pct float64) *models.Flag {
	f := baseFlag(pct)
	return &f
}

func with(pct float64, change func(f *models.Flag)) *models.Flag {
	f := baseFlag(pct)
	change(&f)
	return &f
}

func TestEvaluateReasons(t *testing.T) {
	aarav := map[string]any{"userId": "u_aarav", "country": "India", "plan": "premium", "betaUser": true}
	emma := map[string]any{"userId": "u_emma", "country": "US", "plan": "premium", "betaUser": false}
	aaravBucket := rollout.Bucket("new_payment_flow", testSalt, "u_aarav")
	// Percentages that put u_aarav just inside and just outside the rollout.
	justIn := float64(aaravBucket+1) / 100
	justOut := float64(aaravBucket) / 100
	indiaOnly := []models.Condition{{Attribute: "country", Operator: "in", Values: []any{"India"}}}

	tests := []struct {
		name        string
		flag        *models.Flag
		ctx         map[string]any
		wantVariant string
		wantReason  string
		wantBucket  int
	}{
		{"1 flag does not exist", nil, aarav, VariantOff, ReasonFlagNotFound, NoBucket},
		{"2 draft", with(0, func(f *models.Flag) { f.Status = models.StatusDraft; f.Enabled = false }),
			aarav, "old", ReasonNotStarted, NoBucket},
		{"3 kill switch", with(0, func(f *models.Flag) { f.Enabled = false; f.Status = models.StatusRolledBack }),
			aarav, "old", ReasonKillSwitch, NoBucket},
		{"4 rolled back", with(0, func(f *models.Flag) { f.Status = models.StatusRolledBack }),
			aarav, "old", ReasonRolledBack, NoBucket},
		{"5 override exclude", with(100, func(f *models.Flag) { f.Overrides.Exclude = []string{"u_aarav"} }),
			aarav, "old", ReasonOverrideExclude, NoBucket},
		{"6 override include", with(0.01, func(f *models.Flag) { f.Overrides.Include = []string{"u_aarav"} }),
			aarav, "new", ReasonOverrideInclude, NoBucket},
		{"7 not eligible", with(100, func(f *models.Flag) { f.Conditions = indiaOnly }),
			emma, "old", ReasonNotEligible, NoBucket},
		{"8 no bucket key", flagAt(100), map[string]any{"country": "India"}, "old", ReasonNoBucketKey, NoBucket},
		{"9 in rollout", flagAt(justIn), aarav, "new", ReasonInRollout, aaravBucket},
		{"10 outside rollout", flagAt(justOut), aarav, "old", ReasonOutsideRollout, aaravBucket},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := evaluate(tc.flag, "new_payment_flow", tc.ctx)
			if got.Variant != tc.wantVariant || got.Reason != tc.wantReason || got.Bucket != tc.wantBucket {
				t.Fatalf("got variant=%s reason=%s bucket=%d, want variant=%s reason=%s bucket=%d",
					got.Variant, got.Reason, got.Bucket, tc.wantVariant, tc.wantReason, tc.wantBucket)
			}
		})
	}
}

// TestEvaluatePrecedence checks that earlier rules win when several apply.
func TestEvaluatePrecedence(t *testing.T) {
	aarav := map[string]any{"userId": "u_aarav", "country": "India"}
	usUser := map[string]any{"userId": "u_aarav", "country": "US"}
	usOnly := []models.Condition{{Attribute: "country", Operator: "eq", Values: []any{"US"}}}

	tests := []struct {
		name       string
		flag       *models.Flag
		ctx        map[string]any
		wantReason string
	}{
		{"draft beats kill switch", with(0, func(f *models.Flag) { f.Status = models.StatusDraft; f.Enabled = false }),
			aarav, ReasonNotStarted},
		{"kill switch beats rolled back", with(0, func(f *models.Flag) { f.Enabled = false; f.Status = models.StatusRolledBack }),
			aarav, ReasonKillSwitch},
		{"rolled back beats include override", with(0, func(f *models.Flag) {
			f.Status = models.StatusRolledBack
			f.Overrides.Include = []string{"u_aarav"}
		}), aarav, ReasonRolledBack},
		{"exclude beats include", with(100, func(f *models.Flag) {
			f.Overrides.Include = []string{"u_aarav"}
			f.Overrides.Exclude = []string{"u_aarav"}
		}), aarav, ReasonOverrideExclude},
		{"include beats conditions", with(100, func(f *models.Flag) {
			f.Overrides.Include = []string{"u_aarav"}
			f.Conditions = usOnly
		}), aarav, ReasonOverrideInclude},
		{"conditions beat missing userId", with(100, func(f *models.Flag) { f.Conditions = usOnly }),
			map[string]any{"country": "India"}, ReasonNotEligible},
		{"eligible user is bucketed", with(100, func(f *models.Flag) { f.Conditions = usOnly }),
			usUser, ReasonInRollout},
		{"empty userId has no bucket key", flagAt(100), map[string]any{"userId": ""}, ReasonNoBucketKey},
		{"non-string userId has no bucket key", flagAt(100), map[string]any{"userId": float64(42)}, ReasonNoBucketKey},
		{"paused evaluates at its percentage", with(100, func(f *models.Flag) { f.Status = models.StatusPaused }),
			aarav, ReasonInRollout},
		{"completed evaluates at its percentage", with(100, func(f *models.Flag) { f.Status = models.StatusCompleted }),
			aarav, ReasonInRollout},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := evaluate(tc.flag, "new_payment_flow", tc.ctx); got.Reason != tc.wantReason {
				t.Fatalf("got reason %s, want %s", got.Reason, tc.wantReason)
			}
		})
	}
}

func TestEvaluateResultFields(t *testing.T) {
	got := evaluate(with(25, func(f *models.Flag) { f.Version = 9 }), "new_payment_flow",
		map[string]any{"userId": "u_aarav"})
	if got.FlagKey != "new_payment_flow" || got.RolloutPercentage != 25 || got.FlagVersion != 9 {
		t.Fatalf("unexpected result %+v", got)
	}

	missing := evaluate(nil, "no_such_flag", nil)
	want := Result{FlagKey: "no_such_flag", Variant: VariantOff, Reason: ReasonFlagNotFound, Bucket: NoBucket}
	if missing != want {
		t.Fatalf("got %+v, want %+v", missing, want)
	}
}

// TestSnapshotNextEvaluationUsesNewPercentage covers S6's "right after a
// rollout/set call the very next evaluation uses the new percentage".
func TestSnapshotNextEvaluationUsesNewPercentage(t *testing.T) {
	snap := NewSnapshot()
	ev := NewEvaluator(snap)
	user := map[string]any{"userId": "u_aarav"}
	bucket := rollout.Bucket("new_payment_flow", testSalt, "u_aarav")

	snap.Set(baseFlag(float64(bucket) / 100))
	if got := ev.Preview("new_payment_flow", user); got.Reason != ReasonOutsideRollout {
		t.Fatalf("before set: got %s, want %s", got.Reason, ReasonOutsideRollout)
	}

	next := baseFlag(float64(bucket+1) / 100)
	next.Version = 8
	snap.Set(next)
	got := ev.Preview("new_payment_flow", user)
	if got.Reason != ReasonInRollout || got.FlagVersion != 8 {
		t.Fatalf("after set: got %s v%d, want %s v8", got.Reason, got.FlagVersion, ReasonInRollout)
	}
}

func TestSnapshotKeepsNewerVersion(t *testing.T) {
	snap := NewSnapshot()
	newer := baseFlag(25)
	newer.Version = 10
	older := baseFlag(5)
	older.Version = 9

	snap.Set(newer)
	snap.Set(older)
	if f, _ := snap.Get("new_payment_flow"); f.Version != 10 {
		t.Fatalf("Set replaced v10 with v%d", f.Version)
	}

	snap.Replace([]models.Flag{older})
	if f, _ := snap.Get("new_payment_flow"); f.Version != 10 {
		t.Fatalf("Replace replaced v10 with v%d", f.Version)
	}

	recreated := baseFlag(0)
	recreated.ID = "22222222-2222-2222-2222-222222222222"
	recreated.Version = 1
	snap.Replace([]models.Flag{recreated})
	if f, _ := snap.Get("new_payment_flow"); f.ID != recreated.ID {
		t.Fatal("Replace kept a flag whose ID no longer exists")
	}

	snap.Replace(nil)
	if snap.Len() != 0 {
		t.Fatalf("Replace(nil) left %d flags", snap.Len())
	}
}
