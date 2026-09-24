package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"flagguard/platform/internal/flags"
	"flagguard/platform/internal/rollout"
)

// Contract error codes (README 8.1).
const (
	CodeBadRequest        = "BAD_REQUEST"
	CodeUnauthorized      = "UNAUTHORIZED"
	CodeNotFound          = "NOT_FOUND"
	CodeAlreadyExists     = "ALREADY_EXISTS"
	CodeInvalidTransition = "INVALID_TRANSITION"
	CodeVersionConflict   = "VERSION_CONFLICT"
	CodeValidationFailed  = "VALIDATION_FAILED"
	CodeInternal          = "INTERNAL"
)

const maxBodyBytes = 1 << 20

type errorBody struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Warn("writing response", "error", err)
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorBody{Error: errorDetail{Code: code, Message: message}})
}

// writeServiceError maps a service error to its contract status and code.
// Unknown errors are logged and returned as 500 INTERNAL.
func writeServiceError(w http.ResponseWriter, r *http.Request, err error) {
	var validationErr *flags.ValidationError
	var transitionErr *rollout.TransitionError
	switch {
	case errors.As(err, &validationErr):
		writeError(w, http.StatusUnprocessableEntity, CodeValidationFailed, validationErr.Message)
	case errors.As(err, &transitionErr):
		writeError(w, http.StatusConflict, CodeInvalidTransition, transitionErr.Message)
	case errors.Is(err, flags.ErrNotFound):
		writeError(w, http.StatusNotFound, CodeNotFound, err.Error())
	case errors.Is(err, flags.ErrAlreadyExists):
		writeError(w, http.StatusConflict, CodeAlreadyExists, err.Error())
	default:
		slog.Error("request failed", "method", r.Method, "path", r.URL.Path, "error", err)
		writeError(w, http.StatusInternalServerError, CodeInternal, "internal server error")
	}
}

// decodeJSON reads a JSON request body into dst. An empty body is allowed
// only when allowEmpty is true, leaving dst unchanged. On failure it writes
// a 400 response and returns false.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any, allowEmpty bool) bool {
	err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes)).Decode(dst)
	if errors.Is(err, io.EOF) {
		if allowEmpty {
			return true
		}
		writeError(w, http.StatusBadRequest, CodeBadRequest, "request body is required")
		return false
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, CodeBadRequest, "invalid JSON body: "+err.Error())
		return false
	}
	return true
}

func notFound(w http.ResponseWriter, _ *http.Request) {
	writeError(w, http.StatusNotFound, CodeNotFound, "route not found")
}

func methodNotAllowed(w http.ResponseWriter, _ *http.Request) {
	writeError(w, http.StatusMethodNotAllowed, CodeBadRequest, "method not allowed")
}
