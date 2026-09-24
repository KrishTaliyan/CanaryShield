package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"flagguard/platform/internal/guardian"
)

type guardianHandlers struct {
	guardian *guardian.Guardian
}

// health serves GET /flags/{key}/health.
func (h *guardianHandlers) health(w http.ResponseWriter, r *http.Request) {
	hl, err := h.guardian.Health(r.Context(), chi.URLParam(r, "key"))
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, hl)
}

// listIncidents serves GET /incidents?status=open|resolved.
func (h *guardianHandlers) listIncidents(w http.ResponseWriter, r *http.Request) {
	list, err := h.guardian.ListIncidents(r.Context(), r.URL.Query().Get("status"))
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"incidents": list})
}

// getIncident serves GET /incidents/{id}.
func (h *guardianHandlers) getIncident(w http.ResponseWriter, r *http.Request) {
	inc, err := h.guardian.GetIncident(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, inc)
}

// resolveIncident serves POST /incidents/{id}/resolve.
func (h *guardianHandlers) resolveIncident(w http.ResponseWriter, r *http.Request) {
	inc, err := h.guardian.ResolveIncident(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, inc)
}
