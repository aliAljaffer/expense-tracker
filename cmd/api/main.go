// Command api serves the owner-only grooszy API.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/aliAljaffer/grooszy/api/migrations"
	"github.com/aliAljaffer/grooszy/internal/auth"
	"github.com/aliAljaffer/grooszy/internal/config"
	"github.com/aliAljaffer/grooszy/internal/explain"
	"github.com/aliAljaffer/grooszy/internal/httpapi"
	"github.com/aliAljaffer/grooszy/internal/importer"
	"github.com/aliAljaffer/grooszy/internal/ledger"
	"github.com/aliAljaffer/grooszy/internal/migrate"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("api stopped", "error", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	store, err := importer.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer store.Close()

	led, err := ledger.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer led.Close()

	if err := migrate.Apply(ctx, store.Pool(), migrations.FS); err != nil {
		dbURL := cfg.DatabaseURL
		if idx := strings.Index(dbURL, "://"); idx >= 0 {
			if idx2 := strings.Index(dbURL[idx+3:], "@"); idx2 >= 0 {
				dbURL = dbURL[:idx+3] + "***@" + dbURL[idx+3+idx2+1:]
			}
		}
		log.Error("apply migrations", "error", err, "database", dbURL)
		os.Exit(1)
	}

	if err := importer.BackfillMerchants(ctx, store.Pool()); err != nil {
		return fmt.Errorf("backfill merchants: %w", err)
	}

	discoveryCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	verifier, err := auth.New(discoveryCtx, cfg.OIDCIssuer, cfg.OIDCAudience, cfg.OwnerSubject)
	cancel()
	if err != nil {
		return err
	}

	svc := importer.NewService(store)
	if err := svc.Cleanup(ctx); err != nil {
		log.Warn("preview cleanup failed", "error", err)
	}
	go cleanupLoop(ctx, svc, log)

	explainer := explain.New(explain.ConfigFromEnv())

	srv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           httpapi.New(svc, led, verifier, cfg.MaxUploadBytes, explainer, log),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	shutdown := make(chan struct{})
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		srv.Shutdown(shutdownCtx)
		close(shutdown)
	}()

	log.Info("api listening", "addr", cfg.ListenAddr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	<-shutdown
	return nil
}

func cleanupLoop(ctx context.Context, svc *importer.Service, log *slog.Logger) {
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := svc.Cleanup(ctx); err != nil {
				log.Warn("preview cleanup failed", "error", err)
			}
		}
	}
}
