// Package httpapi is the platform's HTTP layer: routing, auth and handlers.
package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"flagguard/platform/internal/config"
	"flagguard/platform/internal/flags"
)

// Deps are the services the HTTP layer calls.
type Deps struct {
	Config config.Config
	Flags  *flags.Service
}

// NewRouter builds the platform's HTTP handler.
func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: d.Config.CORSOrigins,
		AllowedMethods: []string{
			http.MethodGet, http.MethodPost, http.MethodPut,
			http.MethodPatch, http.MethodDelete, http.MethodOptions,
		},
		AllowedHeaders: []string{"Authorization", "Content-Type", "X-API-Key"},
		MaxAge:         300,
	}))
	r.NotFound(notFound)
	r.MethodNotAllowed(methodNotAllowed)

	r.Get("/healthz", healthz)
	r.Method(http.MethodGet, "/metrics", promhttp.Handler())

	fh := &flagHandlers{flags: d.Flags}

	r.Route("/api/v1", func(r chi.Router) {
		r.Use(adminAuth(d.Config.AdminToken))

		r.Get("/flags", fh.list)
		r.Post("/flags", fh.create)
		r.Get("/flags/{key}", fh.get)
		r.Patch("/flags/{key}", fh.update)

		r.Post("/flags/{key}/rollout/start", fh.start)
		r.Post("/flags/{key}/rollout/advance", fh.advance)
		r.Post("/flags/{key}/rollout/set", fh.set)
		r.Post("/flags/{key}/rollout/pause", fh.pause)
		r.Post("/flags/{key}/rollout/resume", fh.resume)
		r.Post("/flags/{key}/rollback", fh.rollback)
		r.Post("/flags/{key}/kill", fh.kill)
		r.Get("/flags/{key}/events", fh.events)
	})

	r.Route("/sdk/v1", func(r chi.Router) {
		r.Use(sdkAuth(d.Config.SDKAPIKey))
	})

	return r
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
