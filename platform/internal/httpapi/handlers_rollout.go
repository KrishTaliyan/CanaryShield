package httpapi

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"flagguard/platform/internal/flags"
	"flagguard/platform/internal/rollout"
)

const (
	defaultEventLimit = 50
	maxEventLimit     = 200
)

func (h *flagHandlers) start(w http.ResponseWriter, r *http.Request) {
	h.applyRollout(w, r, rollout.ActionStart, flags.RolloutInput{})
}

func (h *flagHandlers) advance(w http.ResponseWriter, r *http.Request) {
	h.applyRollout(w, r, rollout.ActionAdvance, flags.RolloutInput{})
}

func (h *flagHandlers) set(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Percentage float64 `json:"percentage"`
	}
	if !decodeJSON(w, r, &body, false) {
		return
	}
	h.applyRollout(w, r, rollout.ActionSet, flags.RolloutInput{Percentage: body.Percentage})
}

func (h *flagHandlers) pause(w http.ResponseWriter, r *http.Request) {
	h.applyRollout(w, r, rollout.ActionPause, flags.RolloutInput{})
}

func (h *flagHandlers) resume(w http.ResponseWriter, r *http.Request) {
	h.applyRollout(w, r, rollout.ActionResume, flags.RolloutInput{})
}

func (h *flagHandlers) rollback(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Reason string `json:"reason"`
	}
	if !decodeJSON(w, r, &body, true) {
		return
	}
	h.applyRollout(w, r, rollout.ActionRollback, flags.RolloutInput{Reason: body.Reason})
}

func (h *flagHandlers) kill(w http.ResponseWriter, r *http.Request) {
	h.applyRollout(w, r, rollout.ActionKill, flags.RolloutInput{})
}

func (h *flagHandlers) applyRollout(w http.ResponseWriter, r *http.Request, action rollout.Action, in flags.RolloutInput) {
	f, err := h.flags.Rollout(r.Context(), chi.URLParam(r, "key"), action, in)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, f)
}

func (h *flagHandlers) events(w http.ResponseWriter, r *http.Request) {
	limit := defaultEventLimit
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 {
			writeError(w, http.StatusUnprocessableEntity, CodeValidationFailed, "limit must be a positive integer")
			return
		}
		limit = min(n, maxEventLimit)
	}

	events, err := h.flags.ListEvents(r.Context(), chi.URLParam(r, "key"), limit)
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"events": events})
}
