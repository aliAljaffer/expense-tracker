package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/aliAljaffer/expense-tracker/api/migrations"
	"github.com/aliAljaffer/expense-tracker/internal/migrate"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	if err := migrate.Apply(ctx, pool, migrations.FS); err != nil {
		log.Fatalf("apply migrations: %v", err)
	}

	fmt.Println("Migrations completed successfully")
}
