package targeting

import (
	"testing"

	"flagguard/platform/internal/models"
)

func cond(attr, op string, values ...any) models.Condition {
	if values == nil {
		values = []any{}
	}
	return models.Condition{Attribute: attr, Operator: op, Values: values}
}

func TestMatchOne(t *testing.T) {
	aarav := map[string]any{
		"userId": "u_aarav", "country": "India", "plan": "premium", "betaUser": true, "age": float64(30),
	}

	tests := []struct {
		name string
		c    models.Condition
		ctx  map[string]any
		want bool
	}{
		// eq
		{"eq string", cond("country", OpEq, "India"), aarav, true},
		{"eq string is case-insensitive", cond("country", OpEq, "INDIA"), aarav, true},
		{"eq string mismatch", cond("country", OpEq, "US"), aarav, false},
		{"eq bool", cond("betaUser", OpEq, true), aarav, true},
		{"eq bool against string true", cond("betaUser", OpEq, "true"), aarav, true},
		{"eq string true against bool", cond("betaUser", OpEq, true), map[string]any{"betaUser": "TRUE"}, true},
		{"eq bool mismatch", cond("betaUser", OpEq, false), aarav, false},
		{"eq bool against non-bool string", cond("betaUser", OpEq, "yes"), aarav, false},
		{"eq number", cond("age", OpEq, float64(30)), aarav, true},
		{"eq number against numeric string", cond("age", OpEq, "30"), aarav, true},
		{"eq numeric string against number", cond("age", OpEq, float64(30)), map[string]any{"age": "30.0"}, true},
		{"eq number against text", cond("age", OpEq, "thirty"), aarav, false},
		{"eq string against bool value", cond("country", OpEq, true), aarav, false},
		{"eq with no values", cond("country", OpEq), aarav, false},
		{"eq missing attribute", cond("city", OpEq, "Delhi"), aarav, false},

		// neq
		{"neq different", cond("country", OpNeq, "US"), aarav, true},
		{"neq same, other case", cond("country", OpNeq, "india"), aarav, false},
		{"neq bool", cond("betaUser", OpNeq, "false"), aarav, true},
		{"neq missing attribute fails closed", cond("city", OpNeq, "Delhi"), aarav, false},

		// in / not_in
		{"in match", cond("country", OpIn, "US", "India"), aarav, true},
		{"in case-insensitive", cond("plan", OpIn, "PREMIUM"), aarav, true},
		{"in no match", cond("country", OpIn, "US", "UK"), aarav, false},
		{"in mixed types", cond("age", OpIn, "25", float64(30)), aarav, true},
		{"in bools", cond("betaUser", OpIn, "true"), aarav, true},
		{"in missing attribute", cond("city", OpIn, "Delhi"), aarav, false},
		{"not_in match", cond("country", OpNotIn, "US", "UK"), aarav, true},
		{"not_in excluded", cond("country", OpNotIn, "India"), aarav, false},
		{"not_in missing attribute fails closed", cond("city", OpNotIn, "Delhi"), aarav, false},

		// gt / lt
		{"gt true", cond("age", OpGt, float64(18)), aarav, true},
		{"gt equal is false", cond("age", OpGt, float64(30)), aarav, false},
		{"gt with numeric string threshold", cond("age", OpGt, "18"), aarav, true},
		{"gt with numeric string attribute", cond("age", OpGt, float64(18)), map[string]any{"age": "30"}, true},
		{"gt non-numeric attribute never matches", cond("country", OpGt, float64(1)), aarav, false},
		{"gt bool attribute never matches", cond("betaUser", OpGt, float64(0)), aarav, false},
		{"gt non-numeric threshold never matches", cond("age", OpGt, "abc"), aarav, false},
		{"gt missing attribute", cond("score", OpGt, float64(1)), aarav, false},
		{"lt true", cond("age", OpLt, float64(40)), aarav, true},
		{"lt false", cond("age", OpLt, float64(20)), aarav, false},
		{"lt NaN string never matches", cond("age", OpLt, "NaN"), aarav, false},

		// exists
		{"exists present", cond("plan", OpExists), aarav, true},
		{"exists present with false value", cond("betaUser", OpExists), map[string]any{"betaUser": false}, true},
		{"exists missing", cond("city", OpExists), aarav, false},
		{"exists null counts as missing", cond("city", OpExists), map[string]any{"city": nil}, false},

		// other
		{"null attribute value is missing", cond("city", OpNeq, "Delhi"), map[string]any{"city": nil}, false},
		{"unknown operator never matches", cond("country", "like", "Ind"), aarav, false},
		{"nil context", cond("country", OpEq, "India"), nil, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := matchOne(tc.c, tc.ctx); got != tc.want {
				t.Fatalf("matchOne(%+v) = %v, want %v", tc.c, got, tc.want)
			}
		})
	}
}

func TestMatchesCombinesWithAnd(t *testing.T) {
	ctx := map[string]any{"country": "India", "plan": "free"}
	tests := []struct {
		name       string
		conditions []models.Condition
		want       bool
	}{
		{"no conditions means everyone", nil, true},
		{"all match", []models.Condition{cond("country", OpEq, "India"), cond("plan", OpEq, "free")}, true},
		{"one fails", []models.Condition{cond("country", OpEq, "India"), cond("plan", OpEq, "premium")}, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := Matches(tc.conditions, ctx); got != tc.want {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}

func TestValidateCondition(t *testing.T) {
	tests := []struct {
		name    string
		c       models.Condition
		wantErr bool
	}{
		{"eq ok", cond("country", OpEq, "India"), false},
		{"neq ok", cond("plan", OpNeq, "free"), false},
		{"in ok", cond("country", OpIn, "India", "US"), false},
		{"not_in ok", cond("country", OpNotIn, "UK"), false},
		{"gt ok", cond("age", OpGt, float64(18)), false},
		{"lt numeric string ok", cond("age", OpLt, "65"), false},
		{"exists ok", cond("betaUser", OpExists), false},
		{"bool value ok", cond("betaUser", OpEq, true), false},
		{"unknown operator", cond("country", "like", "Ind"), true},
		{"empty operator", cond("country", "", "India"), true},
		{"blank attribute", cond("  ", OpEq, "India"), true},
		{"eq without value", cond("country", OpEq), true},
		{"eq with two values", cond("country", OpEq, "India", "US"), true},
		{"gt non-numeric", cond("age", OpGt, "old"), true},
		{"in without values", cond("country", OpIn), true},
		{"exists with values", cond("plan", OpExists, "premium"), true},
		{"nested array value", cond("country", OpIn, []any{"India"}), true},
		{"null value", cond("country", OpEq, nil), true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateCondition(tc.c)
			if (err != nil) != tc.wantErr {
				t.Fatalf("ValidateCondition(%+v) error = %v, wantErr %v", tc.c, err, tc.wantErr)
			}
		})
	}
}
