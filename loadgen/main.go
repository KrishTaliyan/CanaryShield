// Command loadgen simulates QuickCart shoppers paying through POST /api/pay
// (README 9.7) so the guardian has traffic to watch.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"math"
	"math/rand/v2"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

const (
	summaryInterval = 5 * time.Second
	requestTimeout  = 10 * time.Second
)

type product struct {
	ID    json.RawMessage `json:"id"`
	Price float64         `json:"price"`
}

type payItem struct {
	ProductID json.RawMessage `json:"productId"`
	Qty       int             `json:"qty"`
}

type payRequest struct {
	User   User      `json:"user"`
	Items  []payItem `json:"items"`
	Amount float64   `json:"amount"`
}

// stats are cumulative counters, safe for concurrent use.
type stats struct {
	sent, succeeded, failed atomic.Int64
	oldOK, oldFailed        atomic.Int64
	newOK, newFailed        atomic.Int64
	noFlow                  atomic.Int64
}

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("loadgen stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	target := flag.String("target", "http://localhost:4000", "QuickCart server base URL")
	rps := flag.Float64("rps", 30, "requests per second")
	userCount := flag.Int("users", 5000, "number of simulated users")
	duration := flag.Duration("duration", 10*time.Minute, "how long to run")
	seed := flag.Uint64("seed", 42, "random seed for users and requests")
	flag.Parse()

	switch {
	case *rps <= 0:
		return errors.New("-rps must be greater than 0")
	case *userCount < 1:
		return errors.New("-users must be at least 1")
	case *duration <= 0:
		return errors.New("-duration must be greater than 0")
	}
	base := strings.TrimRight(*target, "/")

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	client := &http.Client{
		Timeout: requestTimeout,
		Transport: &http.Transport{
			MaxIdleConns:        200,
			MaxIdleConnsPerHost: 200,
			IdleConnTimeout:     90 * time.Second,
		},
	}

	products, err := fetchProducts(ctx, client, base)
	if err != nil {
		return err
	}
	users := generateUsers(*userCount, *seed)
	slog.Info("loadgen starting", "target", base, "rps", *rps, "users", len(users),
		"products", len(products), "duration", duration.String(), "seed", *seed)

	runCtx, cancel := context.WithTimeout(ctx, *duration)
	defer cancel()

	var st stats
	var inFlight sync.WaitGroup
	r := rand.New(rand.NewPCG(*seed, *seed+1))
	start := time.Now()

	send := time.NewTicker(time.Duration(float64(time.Second) / *rps))
	defer send.Stop()
	summary := time.NewTicker(summaryInterval)
	defer summary.Stop()

	var lastSent int64
loop:
	for {
		select {
		case <-runCtx.Done():
			break loop
		case <-summary.C:
			lastSent = logSummary("summary", &st, start, lastSent)
		case <-send.C:
			req := buildRequest(r, users, products)
			inFlight.Add(1)
			go func() {
				defer inFlight.Done()
				pay(ctx, client, base, req, &st)
			}()
		}
	}

	inFlight.Wait()
	logSummary("final summary", &st, start, lastSent)
	return nil
}

func fetchProducts(ctx context.Context, client *http.Client, base string) ([]product, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/api/products", nil)
	if err != nil {
		return nil, fmt.Errorf("building products request: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching products from %s: %w", base, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetching products: unexpected status %s", resp.Status)
	}

	var body struct {
		Products []product `json:"products"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("decoding products: %w", err)
	}
	if len(body.Products) == 0 {
		return nil, errors.New("QuickCart returned no products")
	}
	return body.Products, nil
}

// buildRequest picks a random user and 1–3 distinct random products.
func buildRequest(r *rand.Rand, users []User, products []product) payRequest {
	n := 1 + r.IntN(min(3, len(products)))
	items := make([]payItem, 0, n)
	var amount float64
	for _, i := range r.Perm(len(products))[:n] {
		items = append(items, payItem{ProductID: products[i].ID, Qty: 1})
		amount += products[i].Price
	}
	return payRequest{
		User:   users[r.IntN(len(users))],
		Items:  items,
		Amount: math.Round(amount*100) / 100,
	}
}

// pay sends one payment and records the outcome by flow.
func pay(ctx context.Context, client *http.Client, base string, body payRequest, st *stats) {
	st.sent.Add(1)
	data, err := json.Marshal(body)
	if err != nil {
		st.failed.Add(1)
		st.noFlow.Add(1)
		return
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/api/pay", bytes.NewReader(data))
	if err != nil {
		st.failed.Add(1)
		st.noFlow.Add(1)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		st.failed.Add(1)
		st.noFlow.Add(1)
		return
	}
	defer resp.Body.Close()

	var out struct {
		Flow string `json:"flow"`
	}
	_ = json.NewDecoder(io.LimitReader(resp.Body, 1<<16)).Decode(&out)

	ok := resp.StatusCode == http.StatusOK
	if ok {
		st.succeeded.Add(1)
	} else {
		st.failed.Add(1)
	}
	switch {
	case out.Flow == "old" && ok:
		st.oldOK.Add(1)
	case out.Flow == "old":
		st.oldFailed.Add(1)
	case out.Flow == "new" && ok:
		st.newOK.Add(1)
	case out.Flow == "new":
		st.newFailed.Add(1)
	default:
		st.noFlow.Add(1)
	}
}

// logSummary prints cumulative counts plus the send rate since the last
// summary, and returns the new sent total.
func logSummary(msg string, st *stats, start time.Time, lastSent int64) int64 {
	sent := st.sent.Load()
	slog.Info(msg,
		"elapsed", time.Since(start).Round(time.Second).String(),
		"sent", sent,
		"succeeded", st.succeeded.Load(),
		"failed", st.failed.Load(),
		"rps", math.Round(float64(sent-lastSent)/summaryInterval.Seconds()*10)/10,
		slog.Group("old", "ok", st.oldOK.Load(), "failed", st.oldFailed.Load()),
		slog.Group("new", "ok", st.newOK.Load(), "failed", st.newFailed.Load()),
		"noFlow", st.noFlow.Load(),
	)
	return sent
}
