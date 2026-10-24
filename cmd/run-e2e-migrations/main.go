package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/user"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer conn.Close(ctx)

	// Find migrations directory (relative to current working directory or home directory)
	migDir := "api/migrations"
	if _, err := os.Stat(migDir); os.IsNotExist(err) {
		// Try from home directory + expense-tracker
		home, err := user.Current()
		if err == nil {
			migDir = filepath.Join(home.HomeDir, "expense-tracker", "api", "migrations")
		}
	}

	entries, err := os.ReadDir(migDir)
	if err != nil {
		log.Fatalf("read migrations: %v", err)
	}

	var files []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".up.sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	fmt.Printf("Found %d migration(s)\n", len(files))

	for _, file := range files {
		path := filepath.Join(migDir, file)
		sql, err := os.ReadFile(path)
		if err != nil {
			log.Fatalf("read %s: %v", file, err)
		}

		fmt.Printf("Running migration: %s\n", file)
		if _, err := conn.Exec(ctx, string(sql)); err != nil {
			log.Fatalf("apply %s: %v", file, err)
		}
	}

	fmt.Println("Migrations completed successfully")
}
