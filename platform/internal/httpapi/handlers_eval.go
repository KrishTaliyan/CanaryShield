package httpapi

import (
	"net/http"

	"flagguard/platform/internal/evaluation"
)

type evalHandlers struct {
	evaluator *evaluation.Evaluator
}

// sdkEvaluate serves POST /sdk/v1/evaluate and counts the evaluation.
func (h *evalHandlers) sdkEvaluate(w http.ResponseWriter, r *http.Request) {
	h.handle(w, r, h.evaluator.Evaluate)
}

// playground serves POST /api/v1/playground/evaluate without side effects.
func (h *evalHandlers) playground(w http.ResponseWriter, r *http.Request) {
	h.handle(w, r, h.evaluator.Preview)
}

func (h *evalHandlers) handle(w http.ResponseWriter, r *http.Request,
	evaluate func(flagKey string, ctx map[string]any) evaluation.Result) {
	var body struct {
		FlagKey string         `json:"flagKey"`
		Context map[string]any `json:"context"`
	}
	if !decodeJSON(w, r, &body, false) {
		return
	}
	if body.FlagKey == "" {
		writeError(w, http.StatusUnprocessableEntity, CodeValidationFailed, "flagKey is required")
		return
	}
	writeJSON(w, http.StatusOK, evaluate(body.FlagKey, body.Context))
}
