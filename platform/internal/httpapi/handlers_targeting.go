package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"flagguard/platform/internal/flags"
	"flagguard/platform/internal/models"
)

func (h *flagHandlers) putConditions(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Conditions *[]models.Condition `json:"conditions"`
	}
	if !decodeJSON(w, r, &body, false) {
		return
	}
	if body.Conditions == nil {
		writeError(w, http.StatusUnprocessableEntity, CodeValidationFailed, "conditions is required")
		return
	}

	f, err := h.flags.SetConditions(r.Context(), chi.URLParam(r, "key"), *body.Conditions)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, f)
}

func (h *flagHandlers) putOverrides(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Include *[]string `json:"include"`
		Exclude *[]string `json:"exclude"`
	}
	if !decodeJSON(w, r, &body, false) {
		return
	}
	if body.Include == nil || body.Exclude == nil {
		writeError(w, http.StatusUnprocessableEntity, CodeValidationFailed, "include and exclude are required")
		return
	}

	f, err := h.flags.SetOverrides(r.Context(), chi.URLParam(r, "key"), *body.Include, *body.Exclude)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, f)
}

func (h *flagHandlers) putGuardrail(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Enabled             *bool    `json:"enabled"`
		ErrorRateThreshold  *float64 `json:"errorRateThreshold"`
		MinSamples          *int     `json:"minSamples"`
		ConsecutiveBreaches *int     `json:"consecutiveBreaches"`
	}
	if !decodeJSON(w, r, &body, false) {
		return
	}
	if body.Enabled == nil || body.ErrorRateThreshold == nil || body.MinSamples == nil || body.ConsecutiveBreaches == nil {
		writeError(w, http.StatusUnprocessableEntity, CodeValidationFailed,
			"enabled, errorRateThreshold, minSamples and consecutiveBreaches are required")
		return
	}

	f, err := h.flags.SetGuardrail(r.Context(), chi.URLParam(r, "key"), flags.GuardrailInput{
		Enabled:             *body.Enabled,
		ErrorRateThreshold:  *body.ErrorRateThreshold,
		MinSamples:          *body.MinSamples,
		ConsecutiveBreaches: *body.ConsecutiveBreaches,
	})
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, f)
}
