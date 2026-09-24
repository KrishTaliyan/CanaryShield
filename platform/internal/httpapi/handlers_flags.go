package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"flagguard/platform/internal/flags"
)

type flagHandlers struct {
	flags *flags.Service
}

func (h *flagHandlers) list(w http.ResponseWriter, r *http.Request) {
	list, err := h.flags.List(r.Context())
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"flags": list})
}

func (h *flagHandlers) create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Key         string `json:"key"`
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if !decodeJSON(w, r, &body, false) {
		return
	}

	f, err := h.flags.Create(r.Context(), flags.CreateInput{
		Key: body.Key, Name: body.Name, Description: body.Description,
	})
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, f)
}

func (h *flagHandlers) get(w http.ResponseWriter, r *http.Request) {
	f, err := h.flags.Get(r.Context(), chi.URLParam(r, "key"))
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, f)
}

func (h *flagHandlers) update(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
	}
	if !decodeJSON(w, r, &body, false) {
		return
	}

	f, err := h.flags.Update(r.Context(), chi.URLParam(r, "key"), flags.UpdateInput{
		Name: body.Name, Description: body.Description,
	})
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, f)
}
