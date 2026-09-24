package main

import (
	"fmt"
	"math/rand/v2"
)

// User is the PayRequest user object (README 8.6).
type User struct {
	UserID   string `json:"userId"`
	Country  string `json:"country"`
	Plan     string `json:"plan"`
	BetaUser bool   `json:"betaUser"`
}

// generateUsers builds users u00001..uNNNNN deterministically from seed
// (README 9.7): country India 60%, US 25%, UK 15%; plan premium 30%;
// betaUser 20%.
func generateUsers(n int, seed uint64) []User {
	r := rand.New(rand.NewPCG(seed, seed))
	users := make([]User, n)
	for i := range users {
		country := "UK"
		switch c := r.Float64(); {
		case c < 0.60:
			country = "India"
		case c < 0.85:
			country = "US"
		}
		plan := "free"
		if r.Float64() < 0.30 {
			plan = "premium"
		}
		users[i] = User{
			UserID:   fmt.Sprintf("u%05d", i+1),
			Country:  country,
			Plan:     plan,
			BetaUser: r.Float64() < 0.20,
		}
	}
	return users
}
