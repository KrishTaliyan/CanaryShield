// Command server runs the FlagGuard platform API.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"flagguard/platform/internal/cache"
	"flagguard/platform/internal/config"
	"flagguard/platform/internal/db"
	"flagguard/platform/internal/evaluation"
	"flagguard/platform/internal/flags"
	"flagguard/platform/internal/httpapi"
)

const shutdownTimeout = 10 * time.Second

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	if err := run(); err != nil {
		slog.Error("platform stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	rdb, err := cache.NewRedis(cfg.RedisURL)
	if err != nil {
		return err
	}
	defer rdb.Close()

	snapshot := evaluation.NewSnapshot()
	flagService := flags.NewService(pool, snapshot, rdb)
	if err := cache.LoadSnapshot(ctx, rdb, flagService, snapshot); err != nil {
		return err
	}
	go rdb.Subscribe(ctx, snapshot, flagService)
	go cache.RunReconciler(ctx, rdb, flagService, snapshot, cache.ReconcileInterval)

	srv := &http.Server{
		Addr: ":" + cfg.Port,
		Handler: httpapi.NewRouter(httpapi.Deps{
			Config:    cfg,
			Flags:     flagService,
			Evaluator: evaluation.NewEvaluator(snapshot),
		}),
		ReadHeaderTimeout: 5 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		slog.Info("platform listening", "addr", srv.Addr)
		serveErr <- srv.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		return fmt.Errorf("serving http: %w", err)
	case <-ctx.Done():
	}

	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("shutting down http server: %w", err)
	}
	return nil
}
