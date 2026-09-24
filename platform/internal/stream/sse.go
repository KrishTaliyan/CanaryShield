// Package stream pushes live events to dashboards over Server-Sent Events
// (README 8.5).
package stream

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"flagguard/platform/internal/models"
)

const (
	heartbeatInterval = 15 * time.Second
	// clientBuffer is how many events a client may fall behind before it is
	// disconnected; EventSource reconnects on its own.
	clientBuffer = 64
)

type event struct {
	name string
	data []byte
}

// Hub fans events out to every connected client.
type Hub struct {
	mu      sync.Mutex
	clients map[chan event]struct{}
	done    chan struct{}
	closed  bool
}

// NewHub returns a hub with no clients.
func NewHub() *Hub {
	return &Hub{clients: map[chan event]struct{}{}, done: make(chan struct{})}
}

// PublishFlag sends an SSE "flag" event.
func (h *Hub) PublishFlag(f models.Flag) { h.publish("flag", f) }

// PublishRollout sends an SSE "rollout" event.
func (h *Hub) PublishRollout(e models.Event) { h.publish("rollout", e) }

// PublishHealth sends an SSE "health" event.
func (h *Hub) PublishHealth(hl models.Health) { h.publish("health", hl) }

// PublishIncident sends an SSE "incident" event.
func (h *Hub) PublishIncident(i models.Incident) { h.publish("incident", i) }

// Close disconnects every client so the HTTP server can shut down.
func (h *Hub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return
	}
	h.closed = true
	close(h.done)
	for ch := range h.clients {
		delete(h.clients, ch)
		close(ch)
	}
}

func (h *Hub) publish(name string, v any) {
	data, err := json.Marshal(v)
	if err != nil {
		slog.Error("encoding SSE event", "event", name, "error", err)
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.clients {
		select {
		case ch <- event{name: name, data: data}:
		default:
			delete(h.clients, ch)
			close(ch)
		}
	}
}

func (h *Hub) subscribe() (chan event, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed {
		return nil, false
	}
	ch := make(chan event, clientBuffer)
	h.clients[ch] = struct{}{}
	return ch, true
}

func (h *Hub) unsubscribe(ch chan event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[ch]; ok {
		delete(h.clients, ch)
		close(ch)
	}
}

// ServeHTTP streams events to one client until it disconnects.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	rc := http.NewResponseController(w)
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	if err := rc.Flush(); err != nil {
		slog.Warn("SSE is not supported by this connection", "error", err)
		return
	}

	ch, ok := h.subscribe()
	if !ok {
		return
	}
	defer h.unsubscribe(ch)

	heartbeat := time.NewTicker(heartbeatInterval)
	defer heartbeat.Stop()
	for {
		var err error
		select {
		case <-r.Context().Done():
			return
		case <-h.done:
			return
		case <-heartbeat.C:
			_, err = fmt.Fprint(w, ": ping\n\n")
		case ev, open := <-ch:
			if !open {
				return
			}
			_, err = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.name, ev.data)
		}
		if err == nil {
			err = rc.Flush()
		}
		if err != nil {
			return
		}
	}
}
