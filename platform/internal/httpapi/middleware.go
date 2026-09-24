package httpapi

import (
	"crypto/subtle"
	"log/slog"
	"net/http"
	"runtime/debug"
	"strings"
)

// adminAuth requires "Authorization: Bearer <token>".
func adminAuth(token string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			scheme, got, ok := strings.Cut(r.Header.Get("Authorization"), " ")
			if !ok || !strings.EqualFold(scheme, "Bearer") || !secureEqual(got, token) {
				writeError(w, http.StatusUnauthorized, CodeUnauthorized, "missing or invalid admin token")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// sdkAuth requires "X-API-Key: <key>".
func sdkAuth(key string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !secureEqual(r.Header.Get("X-API-Key"), key) {
				writeError(w, http.StatusUnauthorized, CodeUnauthorized, "missing or invalid API key")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// recoverer turns a handler panic into a logged 500 in the contract format.
func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			rec := recover()
			if rec == nil {
				return
			}
			if rec == http.ErrAbortHandler {
				panic(rec)
			}
			slog.Error("panic while handling request",
				"method", r.Method, "path", r.URL.Path, "panic", rec, "stack", string(debug.Stack()))
			writeError(w, http.StatusInternalServerError, CodeInternal, "internal server error")
		}()
		next.ServeHTTP(w, r)
	})
}

func secureEqual(got, want string) bool {
	return got != "" && subtle.ConstantTimeCompare([]byte(got), []byte(want)) == 1
}
