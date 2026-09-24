package rollout

import (
	"crypto/sha256"
	"encoding/binary"
	"math"
)

// Bucket returns a number in [0, 9999]: 0.01% granularity (README 9.2).
func Bucket(flagKey, salt, userID string) int {
	sum := sha256.Sum256([]byte(flagKey + ":" + salt + ":" + userID))
	return int(binary.BigEndian.Uint32(sum[:4]) % 10000)
}

// InRollout reports whether a bucket falls inside the rollout percentage.
func InRollout(bucket int, pct float64) bool {
	return bucket < int(math.Round(pct*100))
}
