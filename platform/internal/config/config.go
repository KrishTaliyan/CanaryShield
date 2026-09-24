// Package config loads platform settings from the environment.
package config

import (
	"os"
	"strings"
)

// Config holds every platform setting. Defaults match README section 5,
// so the platform runs without a .env file.
type Config struct {
	DatabaseURL   string
	RedisURL      string
	PrometheusURL string
	Port          string
	AdminToken    string
	SDKAPIKey     string
	CORSOrigins   []string
}

// Load reads the configuration from environment variables.
func Load() Config {
	return Config{
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://flagguard:flagguard@localhost:5432/flagguard?sslmode=disable"),
		RedisURL:      getEnv("REDIS_URL", "redis://localhost:6379/0"),
		PrometheusURL: getEnv("PROMETHEUS_URL", "http://localhost:9090"),
		Port:          getEnv("PORT", "8080"),
		AdminToken:    getEnv("ADMIN_TOKEN", "dev-admin-token"),
		SDKAPIKey:     getEnv("SDK_API_KEY", "dev-sdk-key"),
		CORSOrigins:   splitList(getEnv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174")),
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	return fallback
}

func splitList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
