package importer

import (
	"context"
	"encoding/json"
	"testing"
)

func TestHistoryReturnsEmptyArrayNotNull(t *testing.T) {
	store := testStore(t)
	defer store.Close()

	history, err := store.History(context.Background(), 999)
	if err != nil {
		t.Fatalf("History failed: %v", err)
	}

	if history == nil {
		t.Fatal("History returned nil instead of empty slice")
	}

	if len(history) != 0 {
		t.Fatalf("Expected empty slice, got %d rows", len(history))
	}

	data, err := json.Marshal(history)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	if string(data) == `null` {
		t.Fatal("JSON contains null instead of []")
	}
}

func TestCommitResultSkippedIsEmptyArrayNotNull(t *testing.T) {
	store := testStore(t)
	defer store.Close()

	result := CommitResult{ImportID: 1, Inserted: 0, Skipped: []SkippedRow{}}

	if result.Skipped == nil {
		t.Fatal("Skipped is nil instead of empty slice")
	}

	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	if string(data) == `{"import_id":1,"inserted":0,"skipped":null}` {
		t.Fatal("JSON contains null for skipped instead of []")
	}
}

func TestPreviewRowsIsEmptyArrayNotNull(t *testing.T) {
	p := &Preview{
		ImportID: 1,
		Rows:     []Row{},
	}

	if p.Rows == nil {
		t.Fatal("Rows is nil instead of empty slice")
	}

	data, err := json.Marshal(p)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	if string(data) == `{"rows":null}` {
		t.Fatal("JSON contains null for rows instead of []")
	}
}
