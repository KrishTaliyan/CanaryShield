// Package targeting decides whether an evaluation context satisfies a
// flag's conditions (README 9.3).
package targeting

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	"flagguard/platform/internal/models"
)

// Condition operators.
const (
	OpEq     = "eq"
	OpNeq    = "neq"
	OpIn     = "in"
	OpNotIn  = "not_in"
	OpGt     = "gt"
	OpLt     = "lt"
	OpExists = "exists"
)

// Matches reports whether ctx satisfies every condition (AND).
// No conditions means everyone is eligible.
func Matches(conditions []models.Condition, ctx map[string]any) bool {
	for _, c := range conditions {
		if !matchOne(c, ctx) {
			return false
		}
	}
	return true
}

func matchOne(c models.Condition, ctx map[string]any) bool {
	value, present := ctx[c.Attribute]
	if value == nil {
		present = false
	}
	if c.Operator == OpExists {
		return present
	}
	// A missing attribute never matches, for every other operator (fail closed).
	if !present {
		return false
	}

	switch c.Operator {
	case OpEq:
		return len(c.Values) > 0 && equal(value, c.Values[0])
	case OpNeq:
		return len(c.Values) > 0 && !equal(value, c.Values[0])
	case OpIn:
		return containsValue(c.Values, value)
	case OpNotIn:
		return !containsValue(c.Values, value)
	case OpGt, OpLt:
		if len(c.Values) == 0 {
			return false
		}
		got, ok1 := toFloat(value)
		want, ok2 := toFloat(c.Values[0])
		if !ok1 || !ok2 {
			return false
		}
		if c.Operator == OpGt {
			return got > want
		}
		return got < want
	}
	return false
}

// ValidateCondition checks that a condition is well formed for its operator.
func ValidateCondition(c models.Condition) error {
	if strings.TrimSpace(c.Attribute) == "" {
		return errors.New("attribute is required")
	}
	for _, v := range c.Values {
		switch v.(type) {
		case string, float64, bool:
		default:
			return fmt.Errorf("values for %q must be strings, numbers or booleans", c.Attribute)
		}
	}

	switch c.Operator {
	case OpEq, OpNeq:
		if len(c.Values) != 1 {
			return fmt.Errorf("%s takes exactly one value", c.Operator)
		}
	case OpGt, OpLt:
		if len(c.Values) != 1 {
			return fmt.Errorf("%s takes exactly one value", c.Operator)
		}
		if _, ok := toFloat(c.Values[0]); !ok {
			return fmt.Errorf("%s needs a numeric value", c.Operator)
		}
	case OpIn, OpNotIn:
		if len(c.Values) == 0 {
			return fmt.Errorf("%s needs at least one value", c.Operator)
		}
	case OpExists:
		if len(c.Values) != 0 {
			return errors.New("exists takes no values")
		}
	default:
		return fmt.Errorf("unknown operator %q", c.Operator)
	}
	return nil
}

func containsValue(values []any, v any) bool {
	for _, want := range values {
		if equal(v, want) {
			return true
		}
	}
	return false
}

// equal compares two scalar values: booleans accept true or "true", numbers
// compare as float64, and strings compare case-insensitively.
func equal(a, b any) bool {
	if isBool(a) || isBool(b) {
		x, ok1 := toBool(a)
		y, ok2 := toBool(b)
		return ok1 && ok2 && x == y
	}
	if isNumber(a) || isNumber(b) {
		x, ok1 := toFloat(a)
		y, ok2 := toFloat(b)
		return ok1 && ok2 && x == y
	}
	x, ok1 := a.(string)
	y, ok2 := b.(string)
	return ok1 && ok2 && strings.EqualFold(x, y)
}

func isBool(v any) bool {
	_, ok := v.(bool)
	return ok
}

func isNumber(v any) bool {
	switch v.(type) {
	case float64, float32, int, int64, int32:
		return true
	}
	return false
}

func toBool(v any) (bool, bool) {
	switch t := v.(type) {
	case bool:
		return t, true
	case string:
		switch {
		case strings.EqualFold(t, "true"):
			return true, true
		case strings.EqualFold(t, "false"):
			return false, true
		}
	}
	return false, false
}

func toFloat(v any) (float64, bool) {
	var f float64
	switch t := v.(type) {
	case float64:
		f = t
	case float32:
		f = float64(t)
	case int:
		f = float64(t)
	case int64:
		f = float64(t)
	case int32:
		f = float64(t)
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(t), 64)
		if err != nil {
			return 0, false
		}
		f = parsed
	default:
		return 0, false
	}
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return 0, false
	}
	return f, true
}
