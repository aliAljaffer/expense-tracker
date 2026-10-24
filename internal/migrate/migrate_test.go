package migrate

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/aliAljaffer/expense-tracker/api/migrations"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL is not set")
	}
	ctx := context.Background()
	admin, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	schema := fmt.Sprintf("test_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "create schema "+pgx.Identifier{schema}.Sanitize()); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	t.Cleanup(func() {
		ctx := context.Background()
		admin.Exec(ctx, "drop schema if exists "+pgx.Identifier{schema}.Sanitize()+" cascade")
		admin.Close(ctx)
	})

	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func TestApplyEmpty(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	if err := Apply(ctx, pool, migrations.FS); err != nil {
		t.Fatalf("Apply: %v", err)
	}

	var count int
	if err := pool.QueryRow(ctx, "select count(*) from schema_migrations").Scan(&count); err != nil {
		t.Fatalf("query schema_migrations: %v", err)
	}

	if count != 2 {
		t.Errorf("expected 2 migrations applied, got %d", count)
	}

	var tableExists bool
	if err := pool.QueryRow(ctx, "select exists(select 1 from information_schema.tables where table_name='transaction')").Scan(&tableExists); err != nil {
		t.Fatalf("check transaction table: %v", err)
	}
	if !tableExists {
		t.Error("expected transaction table to exist")
	}
}

func TestApplyIdempotent(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	if err := Apply(ctx, pool, migrations.FS); err != nil {
		t.Fatalf("Apply first: %v", err)
	}

	if err := Apply(ctx, pool, migrations.FS); err != nil {
		t.Fatalf("Apply second: %v", err)
	}

	var count int
	if err := pool.QueryRow(ctx, "select count(*) from schema_migrations").Scan(&count); err != nil {
		t.Fatalf("query schema_migrations: %v", err)
	}

	if count != 2 {
		t.Errorf("expected 2 migrations, got %d (should not apply duplicates)", count)
	}
}

func TestSchemaMigrationsTable(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	if err := createSchemaMigrationsTable(ctx, pool); err != nil {
		t.Fatalf("create first: %v", err)
	}

	if err := createSchemaMigrationsTable(ctx, pool); err != nil {
		t.Fatalf("create second (should be idempotent): %v", err)
	}
}

func TestMigrationVersions(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	if err := Apply(ctx, pool, migrations.FS); err != nil {
		t.Fatalf("Apply: %v", err)
	}

	rows, err := pool.Query(ctx, "select version from schema_migrations order by version")
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	defer rows.Close()

	var versions []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			t.Fatalf("scan: %v", err)
		}
		versions = append(versions, v)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows error: %v", err)
	}

	expected := []string{"0001_init", "0002_import_preview"}
	if strings.Join(versions, ",") != strings.Join(expected, ",") {
		t.Errorf("expected versions %v, got %v", expected, versions)
	}
}
