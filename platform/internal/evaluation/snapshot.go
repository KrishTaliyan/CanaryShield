package evaluation

import (
	"sync"
	"sync/atomic"

	"flagguard/platform/internal/models"
)

// Snapshot is the in-memory flag set that evaluation reads. Reads are
// lock-free; writers copy the map and swap it atomically (README 9.9).
type Snapshot struct {
	mu    sync.Mutex // serialises writers
	flags atomic.Pointer[map[string]*models.Flag]
}

// NewSnapshot returns an empty snapshot.
func NewSnapshot() *Snapshot {
	s := &Snapshot{}
	empty := map[string]*models.Flag{}
	s.flags.Store(&empty)
	return s
}

// Get returns the flag with the given key. Callers must not modify it.
func (s *Snapshot) Get(key string) (*models.Flag, bool) {
	f, ok := (*s.flags.Load())[key]
	return f, ok
}

// Set stores one flag unless the snapshot already holds a newer version of it.
func (s *Snapshot) Set(f models.Flag) {
	s.mu.Lock()
	defer s.mu.Unlock()

	cur := *s.flags.Load()
	if existing, ok := cur[f.Key]; ok && isNewer(existing, &f) {
		return
	}
	next := make(map[string]*models.Flag, len(cur)+1)
	for k, v := range cur {
		next[k] = v
	}
	next[f.Key] = &f
	s.flags.Store(&next)
}

// Replace swaps in a full flag set, such as a reload from PostgreSQL. Flags
// missing from list are dropped, but a newer version already held for the
// same flag is kept, so a slow reload cannot undo a fresher write.
func (s *Snapshot) Replace(list []models.Flag) {
	s.mu.Lock()
	defer s.mu.Unlock()

	cur := *s.flags.Load()
	next := make(map[string]*models.Flag, len(list))
	for i := range list {
		f := list[i]
		if existing, ok := cur[f.Key]; ok && isNewer(existing, &f) {
			next[f.Key] = existing
			continue
		}
		next[f.Key] = &f
	}
	s.flags.Store(&next)
}

// Len returns the number of flags held.
func (s *Snapshot) Len() int {
	return len(*s.flags.Load())
}

// isNewer reports whether a is a later version of the same flag as b. A flag
// with a different ID (for example, recreated after a database reset) is a
// different flag, so b wins.
func isNewer(a, b *models.Flag) bool {
	return a.ID == b.ID && a.Version > b.Version
}
