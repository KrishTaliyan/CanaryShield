// Package monitoring queries Prometheus for the guardian and the charts.
package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"flagguard/platform/internal/models"
)

// queryTimeout is the Prometheus HTTP client timeout (README 9.8).
const queryTimeout = 2 * time.Second

// Requests per second per flow (README 8.7). These are not per flag.
const (
	rpsNewQuery = `sum(rate(quickcart_payment_requests_total{flow="new"}[30s]))`
	rpsOldQuery = `sum(rate(quickcart_payment_requests_total{flow="old"}[30s]))`
)

// Chart ranges accepted by GET /flags/{key}/metrics, each with a step that
// keeps every chart at about 60 points.
var chartRanges = map[string]struct{ rng, step time.Duration }{
	"5m":  {5 * time.Minute, 5 * time.Second},
	"15m": {15 * time.Minute, 15 * time.Second},
	"30m": {30 * time.Minute, 30 * time.Second},
}

// Point is one chart sample: [unixSeconds, value].
type Point [2]float64

// Metrics is the chart data object from README 8.2.
type Metrics struct {
	FlagKey      string             `json:"flagKey"`
	Threshold    float64            `json:"threshold"`
	RangeSeconds int                `json:"rangeSeconds"`
	StepSeconds  int                `json:"stepSeconds"`
	Series       map[string][]Point `json:"series"`
}

// Client runs PromQL queries against Prometheus's HTTP API.
type Client struct {
	baseURL string
	http    *http.Client
}

// NewClient returns a client for the Prometheus server at baseURL.
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: queryTimeout},
	}
}

// apiResponse is the envelope of /api/v1/query and /api/v1/query_range.
type apiResponse struct {
	Status string `json:"status"`
	Error  string `json:"error"`
	Data   struct {
		Result []struct {
			Value  []any   `json:"value"`
			Values [][]any `json:"values"`
		} `json:"result"`
	} `json:"data"`
}

// Scalar runs an instant query. ok is false when the result is empty or not
// a finite number; err is set only when Prometheus could not be queried.
func (c *Client) Scalar(ctx context.Context, query string) (value float64, ok bool, err error) {
	params := url.Values{"query": {query}}
	resp, err := c.get(ctx, "/api/v1/query", params)
	if err != nil {
		return 0, false, err
	}
	if len(resp.Data.Result) == 0 {
		return 0, false, nil
	}
	_, v, ok := parseSample(resp.Data.Result[0].Value)
	return v, ok, nil
}

// Range runs a range query ending now. Samples that are missing or not
// finite are left out, so the result never contains NaN.
func (c *Client) Range(ctx context.Context, query string, rng, step time.Duration) ([]Point, error) {
	end := time.Now().Truncate(step)
	params := url.Values{
		"query": {query},
		"start": {strconv.FormatInt(end.Add(-rng).Unix(), 10)},
		"end":   {strconv.FormatInt(end.Unix(), 10)},
		"step":  {strconv.Itoa(int(step.Seconds()))},
	}
	resp, err := c.get(ctx, "/api/v1/query_range", params)
	if err != nil {
		return nil, err
	}

	points := []Point{}
	if len(resp.Data.Result) == 0 {
		return points, nil
	}
	for _, sample := range resp.Data.Result[0].Values {
		if ts, v, ok := parseSample(sample); ok {
			points = append(points, Point{ts, v})
		}
	}
	return points, nil
}

// ChartRange returns the range and step for a chart range name.
func ChartRange(name string) (rng, step time.Duration, ok bool) {
	r, ok := chartRanges[name]
	return r.rng, r.step, ok
}

// FlagMetrics returns the four chart series for a flag, querying them in
// parallel.
func (c *Client) FlagMetrics(ctx context.Context, f models.Flag, rng, step time.Duration) (Metrics, error) {
	queries := map[string]string{
		"canaryErrorRate":   f.Guardrail.CanaryErrorQuery,
		"baselineErrorRate": f.Guardrail.BaselineErrorQuery,
		"rpsNew":            rpsNewQuery,
		"rpsOld":            rpsOldQuery,
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	var firstErr error
	series := make(map[string][]Point, len(queries))
	for name, query := range queries {
		wg.Add(1)
		go func() {
			defer wg.Done()
			points, err := c.Range(ctx, query, rng, step)
			mu.Lock()
			defer mu.Unlock()
			if err != nil && firstErr == nil {
				firstErr = fmt.Errorf("querying %s: %w", name, err)
			}
			series[name] = points
		}()
	}
	wg.Wait()
	if firstErr != nil {
		return Metrics{}, firstErr
	}

	return Metrics{
		FlagKey:      f.Key,
		Threshold:    f.Guardrail.ErrorRateThreshold,
		RangeSeconds: int(rng.Seconds()),
		StepSeconds:  int(step.Seconds()),
		Series:       series,
	}, nil
}

func (c *Client) get(ctx context.Context, path string, params url.Values) (apiResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path+"?"+params.Encode(), nil)
	if err != nil {
		return apiResponse{}, fmt.Errorf("building prometheus request: %w", err)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return apiResponse{}, fmt.Errorf("querying prometheus: %w", err)
	}
	defer resp.Body.Close()

	var body apiResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return apiResponse{}, fmt.Errorf("decoding prometheus response (%s): %w", resp.Status, err)
	}
	if body.Status != "success" {
		return apiResponse{}, fmt.Errorf("prometheus query failed (%s): %s", resp.Status, body.Error)
	}
	return body, nil
}

// parseSample reads a Prometheus [timestamp, "value"] pair. ok is false for
// malformed samples and for NaN or infinite values.
func parseSample(sample []any) (ts, value float64, ok bool) {
	if len(sample) != 2 {
		return 0, 0, false
	}
	t, isNum := sample[0].(float64)
	s, isStr := sample[1].(string)
	if !isNum || !isStr {
		return 0, 0, false
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil || math.IsNaN(v) || math.IsInf(v, 0) {
		return 0, 0, false
	}
	return math.Round(t), v, true
}
