package migrate

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type Pool interface {
	Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error)
	Query(context.Context, string, ...interface{}) (pgx.Rows, error)
	QueryRow(context.Context, string, ...interface{}) pgx.Row
	BeginTx(context.Context, pgx.TxOptions) (pgx.Tx, error)
}

func Apply(ctx context.Context, pool Pool, migrations fs.FS) error {
	schemaMigrationsExists, err := tableExists(ctx, pool, "schema_migrations")
	if err != nil {
		return fmt.Errorf("check schema_migrations table: %w", err)
	}

	var applied map[string]bool
	if schemaMigrationsExists {
		applied, err = getAppliedMigrations(ctx, pool)
		if err != nil {
			return fmt.Errorf("get applied migrations: %w", err)
		}
	} else {
		applied, err = adoptOldDatabase(ctx, pool)
		if err != nil {
			return fmt.Errorf("adopt old database: %w", err)
		}

		if err := createSchemaMigrationsTable(ctx, pool); err != nil {
			return fmt.Errorf("create schema_migrations table: %w", err)
		}

		for version := range applied {
			if _, err := pool.Exec(ctx, "insert into schema_migrations (version, applied_at) values ($1, now())", version); err != nil {
				return fmt.Errorf("record migration %s: %w", version, err)
			}
		}
	}

	files, err := fs.Glob(migrations, "*.up.sql")
	if err != nil {
		return fmt.Errorf("glob migrations: %w", err)
	}
	sort.Strings(files)

	for _, file := range files {
		version := strings.TrimSuffix(file, ".up.sql")
		if applied[version] {
			continue
		}

		sql, err := fs.ReadFile(migrations, file)
		if err != nil {
			return fmt.Errorf("read %s: %w", file, err)
		}

		tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
		if err != nil {
			return fmt.Errorf("begin transaction for %s: %w", file, err)
		}

		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("apply %s: %w", file, err)
		}

		if _, err := tx.Exec(ctx, "insert into schema_migrations (version, applied_at) values ($1, now())", version); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("record %s: %w", file, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit %s: %w", file, err)
		}
	}

	return nil
}

func tableExists(ctx context.Context, pool Pool, tableName string) (bool, error) {
	var exists bool
	err := pool.QueryRow(ctx, `
		select exists(
			select 1 from information_schema.tables
			where table_name = $1 and table_schema = current_schema()
		)
	`, tableName).Scan(&exists)
	return exists, err
}

func adoptOldDatabase(ctx context.Context, pool Pool) (map[string]bool, error) {
	applied := make(map[string]bool)

	migration0001Tables := []string{"account", "statement_import", "transaction"}
	all0001Exist := true
	for _, table := range migration0001Tables {
		exists, err := tableExists(ctx, pool, table)
		if err != nil {
			return nil, err
		}
		if !exists {
			all0001Exist = false
			break
		}
	}

	if all0001Exist {
		applied["0001_init"] = true

		exists0002, err := tableExists(ctx, pool, "import_preview")
		if err != nil {
			return nil, err
		}
		if exists0002 {
			applied["0002_import_preview"] = true
		}

		exists0003, err := tableExists(ctx, pool, "merchant")
		if err != nil {
			return nil, err
		}
		if exists0003 {
			applied["0003_bnpl_detection"] = true
		}
		return applied, nil
	}

	for _, table := range migration0001Tables {
		exists, err := tableExists(ctx, pool, table)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, fmt.Errorf("migration 0001_init is incomplete: table %s exists but others are missing", table)
		}
	}

	return applied, nil
}

func createSchemaMigrationsTable(ctx context.Context, pool Pool) error {
	_, err := pool.Exec(ctx, `
		create table if not exists schema_migrations (
			version text primary key,
			applied_at timestamptz not null
		)
	`)
	return err
}

func getAppliedMigrations(ctx context.Context, pool Pool) (map[string]bool, error) {
	rows, err := pool.Query(ctx, "select version from schema_migrations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		applied[version] = true
	}
	return applied, rows.Err()
}
