package httpapi

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"flagguard/platform/internal/flags"
	"flagguard/platform/internal/monitoring"
)

type metricsHandlers struct {
	flags      *flags.Service
	prometheus *monitoring.Client
}

// flagMetrics serves GET /flags/{key}/metrics?range=5m|15m|30m|1h|6h|24h.
func (h *metricsHandlers) flagMetrics(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("range")
	if name == "" {
		name = "5m"
	}
	rng, step, ok := monitoring.ChartRange(name)
	if !ok {
		writeError(w, http.StatusUnprocessableEntity, CodeValidationFailed, "range must be 5m, 15m, 30m, 1h, 6h or 24h")
		return
	}

	f, err := h.flags.Get(r.Context(), chi.URLParam(r, "key"))
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	m, err := h.prometheus.FlagMetrics(r.Context(), f, rng, step)
	if err != nil {
		slog.Warn("chart metrics unavailable", "flag", f.Key, "error", err)
		writeError(w, http.StatusInternalServerError, CodeInternal, "metrics unavailable: prometheus query failed")
		return
	}
	writeJSON(w, http.StatusOK, m)
}
