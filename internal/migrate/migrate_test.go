package migrate

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/aliAljaffer/grooszy/api/migrations"
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

	if count != 3 {
		t.Errorf("expected 3 migrations applied, got %d", count)
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

	if count != 3 {
		t.Errorf("expected 3 migrations, got %d (should not apply duplicates)", count)
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

	expected := []string{"0001_init", "0002_import_preview", "0003_bnpl_detection"}
	if strings.Join(versions, ",") != strings.Join(expected, ",") {
		t.Errorf("expected versions %v, got %v", expected, versions)
	}
}

func TestAdoptOldDatabase(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	sql, err := os.ReadFile("../../api/migrations/0001_init.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, string(sql)); err != nil {
		t.Fatalf("apply 0001: %v", err)
	}

	if err := Apply(ctx, pool, migrations.FS); err != nil {
		t.Fatalf("Apply: %v", err)
	}

	var count int
	if err := pool.QueryRow(ctx, "select count(*) from schema_migrations").Scan(&count); err != nil {
		t.Fatalf("query schema_migrations: %v", err)
	}

	if count != 3 {
		t.Errorf("expected 3 migrations recorded, got %d", count)
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

	expected := []string{"0001_init", "0002_import_preview", "0003_bnpl_detection"}
	if strings.Join(versions, ",") != strings.Join(expected, ",") {
		t.Errorf("expected versions %v, got %v", expected, versions)
	}
}

func TestAdoptOldDatabasePartiallyBuiltErrors(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	_, err := pool.Exec(ctx, `
		create table account (
			id bigint generated always as identity primary key,
			bank text not null,
			number text,
			iban text,
			currency char(3) not null default 'SAR',
			kind text not null,
			owner_is_user boolean not null default true,
			created_at timestamptz not null default now(),
			unique (bank, number)
		)
	`)
	if err != nil {
		t.Fatalf("create partial schema: %v", err)
	}

	applyErr := Apply(ctx, pool, migrations.FS)
	if applyErr == nil {
		t.Fatalf("Apply should fail for partial schema, but it succeeded")
	}
	if !strings.Contains(applyErr.Error(), "migration 0001_init is incomplete") {
		t.Errorf("expected incomplete migration error, got: %v", applyErr)
	}
}

func TestAdoptEmptyDatabase(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	if err := Apply(ctx, pool, migrations.FS); err != nil {
		t.Fatalf("Apply empty database: %v", err)
	}

	var count int
	if err := pool.QueryRow(ctx, "select count(*) from schema_migrations").Scan(&count); err != nil {
		t.Fatalf("query schema_migrations: %v", err)
	}

	if count != 3 {
		t.Errorf("expected 3 migrations applied, got %d", count)
	}
}
