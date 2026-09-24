package rollout

import (
	"fmt"
	"testing"
)

func userIDs(n int) []string {
	ids := make([]string, n)
	for i := range ids {
		ids[i] = fmt.Sprintf("user_%06d", i)
	}
	return ids
}

func TestBucketRange(t *testing.T) {
	for _, id := range userIDs(10000) {
		if b := Bucket("new_payment_flow", "a1b2c3d4e5f60718", id); b < 0 || b > 9999 {
			t.Fatalf("Bucket(%q) = %d, want 0..9999", id, b)
		}
	}
}

func TestBucketDeterministic(t *testing.T) {
	tests := []struct{ flag, salt, user string }{
		{"new_payment_flow", "a1b2c3d4e5f60718", "u_aarav"},
		{"new_payment_flow", "a1b2c3d4e5f60718", "u_demo_canary"},
		{"dark_mode", "0011223344556677", "u00042"},
	}
	for _, tc := range tests {
		t.Run(tc.user, func(t *testing.T) {
			first := Bucket(tc.flag, tc.salt, tc.user)
			for range 100 {
				if got := Bucket(tc.flag, tc.salt, tc.user); got != first {
					t.Fatalf("bucket changed: %d then %d", first, got)
				}
			}
		})
	}
}

func TestInRolloutMonotonic(t *testing.T) {
	steps := []float64{0, 0.01, 1, 5, 10, 12.5, 25, 50, 99.99, 100}
	for _, id := range userIDs(20000) {
		b := Bucket("new_payment_flow", "a1b2c3d4e5f60718", id)
		wasIn := false
		for _, pct := range steps {
			in := InRollout(b, pct)
			if wasIn && !in {
				t.Fatalf("user %q (bucket %d) was in at a lower step but out at %g%%", id, b, pct)
			}
			wasIn = in
		}
	}
}

func TestInRolloutBoundaries(t *testing.T) {
	tests := []struct {
		bucket int
		pct    float64
		want   bool
	}{
		{0, 0, false},
		{9999, 100, true},
		{0, 0.01, true},
		{1, 0.01, false},
		{499, 5, true},
		{500, 5, false},
		{2499, 25, true},
		{2500, 25, false},
		{1249, 12.5, true},
		{1250, 12.5, false},
	}
	for _, tc := range tests {
		t.Run(fmt.Sprintf("bucket %d at %g%%", tc.bucket, tc.pct), func(t *testing.T) {
			if got := InRollout(tc.bucket, tc.pct); got != tc.want {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}

// TestBucketEvenDistribution: 100,000 user IDs at 25% must land in 24.5%–25.5%.
func TestBucketEvenDistribution(t *testing.T) {
	salts := []string{"a1b2c3d4e5f60718", "0011223344556677", "deadbeefcafef00d"}
	ids := userIDs(100000)
	for _, salt := range salts {
		t.Run(salt, func(t *testing.T) {
			in := 0
			for _, id := range ids {
				if InRollout(Bucket("new_payment_flow", salt, id), 25) {
					in++
				}
			}
			share := float64(in) / float64(len(ids)) * 100
			if share < 24.5 || share > 25.5 {
				t.Fatalf("%.3f%% of users in a 25%% rollout, want 24.5%%–25.5%%", share)
			}
		})
	}
}

// TestBucketIndependentPerFlag: different salts must not pick the same users.
// If the two flags were correlated, most of flag A's 25% would also be in
// flag B's 25%; independent flags overlap by about 25% × 25% = 6.25%.
func TestBucketIndependentPerFlag(t *testing.T) {
	ids := userIDs(100000)
	inA, inBoth := 0, 0
	for _, id := range ids {
		a := InRollout(Bucket("new_payment_flow", "a1b2c3d4e5f60718", id), 25)
		b := InRollout(Bucket("new_payment_flow", "0011223344556677", id), 25)
		if a {
			inA++
			if b {
				inBoth++
			}
		}
	}
	overlap := float64(inBoth) / float64(len(ids)) * 100
	if overlap < 5.5 || overlap > 7 {
		t.Fatalf("%.3f%% of users in both flags' 25%% rollout, want about 6.25%% (independent)", overlap)
	}
	if inBoth == inA {
		t.Fatal("flags with different salts selected exactly the same users")
	}
}
