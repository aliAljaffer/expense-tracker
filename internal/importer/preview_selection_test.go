package importer

import (
	"testing"

	"github.com/aliAljaffer/expense-tracker/parsers/statement"
)

func TestDefaultSelection(t *testing.T) {
	// Table-driven tests for DefaultSelection() rule enforcement
	tests := []struct {
		name             string
		rows             []Row
		wantSelected     map[int]bool
		wantHeldCount    int
	}{
		{
			name: "duplicate score 7 selected",
			rows: []Row{
				{
					Transaction: statement.Transaction{PostedDate: "2026-01-05"},
					Duplicate:   &Duplicate{Score: 7, Exact: false},
				},
			},
			wantSelected:  map[int]bool{0: true},
			wantHeldCount: 0,
		},
		{
			name: "duplicate score 8 held",
			rows: []Row{
				{
					Transaction: statement.Transaction{PostedDate: "2026-01-05"},
					Duplicate:   &Duplicate{Score: 8, Exact: false},
				},
			},
			wantSelected:  map[int]bool{},
			wantHeldCount: 1,
		},
		{
			name: "duplicate score 10 held",
			rows: []Row{
				{
					Transaction: statement.Transaction{PostedDate: "2026-01-05"},
					Duplicate:   &Duplicate{Score: 10, Exact: false},
				},
			},
			wantSelected:  map[int]bool{},
			wantHeldCount: 1,
		},
		{
			name: "anomaly score 7 selected",
			rows: []Row{
				{
					Transaction: statement.Transaction{PostedDate: "2026-01-05"},
					Anomaly:     &Anomaly{Score: 7},
				},
			},
			wantSelected:  map[int]bool{0: true},
			wantHeldCount: 0,
		},
		{
			name: "anomaly score 8 held",
			rows: []Row{
				{
					Transaction: statement.Transaction{PostedDate: "2026-01-05"},
					Anomaly:     &Anomaly{Score: 8},
				},
			},
			wantSelected:  map[int]bool{},
			wantHeldCount: 1,
		},
		{
			name: "anomaly score 10 held",
			rows: []Row{
				{
					Transaction: statement.Transaction{PostedDate: "2026-01-05"},
					Anomaly:     &Anomaly{Score: 10},
				},
			},
			wantSelected:  map[int]bool{},
			wantHeldCount: 1,
		},
		{
			name: "both scores low selected",
			rows: []Row{
				{
					Transaction: statement.Transaction{PostedDate: "2026-01-05"},
					Duplicate:   &Duplicate{Score: 5, Exact: false},
					Anomaly:     &Anomaly{Score: 6},
				},
			},
			wantSelected:  map[int]bool{0: true},
			wantHeldCount: 0,
		},
		{
			name: "exact fingerprint match never selected",
			rows: []Row{
				{
					Transaction: statement.Transaction{PostedDate: "2026-01-05"},
					Duplicate:   &Duplicate{Score: 0, Exact: true},
				},
			},
			wantSelected:  map[int]bool{},
			wantHeldCount: 1,
		},
		{
			name: "anomaly high score held regardless of anomaly_ready",
			rows: []Row{
				{
					Transaction: statement.Transaction{PostedDate: "2026-01-05"},
					Anomaly:     &Anomaly{Score: 9},
				},
			},
			wantSelected:  map[int]bool{},
			wantHeldCount: 1,
		},
		{
			name: "multiple rows mixed",
			rows: []Row{
				{Transaction: statement.Transaction{PostedDate: "2026-01-05"}}, // 0: clean
				{Transaction: statement.Transaction{PostedDate: "2026-01-06"}, Duplicate: &Duplicate{Score: 8, Exact: false}}, // 1: held
				{Transaction: statement.Transaction{PostedDate: "2026-01-07"}, Anomaly: &Anomaly{Score: 7}}, // 2: selected
				{Transaction: statement.Transaction{PostedDate: "2026-01-08"}, Duplicate: &Duplicate{Score: 3, Exact: true}}, // 3: held
			},
			wantSelected:  map[int]bool{0: true, 2: true},
			wantHeldCount: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &Preview{Rows: tt.rows}
			selected := p.DefaultSelection()
			selectedMap := make(map[int]bool)
			for _, idx := range selected {
				selectedMap[idx] = true
			}

			if len(selectedMap) != len(tt.wantSelected) {
				t.Errorf("selected count = %d; want %d", len(selectedMap), len(tt.wantSelected))
			}
			for idx := range tt.wantSelected {
				if !selectedMap[idx] {
					t.Errorf("row %d should be selected but is not", idx)
				}
			}
			for idx := range selectedMap {
				if !tt.wantSelected[idx] {
					t.Errorf("row %d should not be selected but is", idx)
				}
			}

			// Count held rows
			heldCount := 0
			for i := range p.Rows {
				if !selectedMap[i] {
					heldCount++
				}
			}
			if heldCount != tt.wantHeldCount {
				t.Errorf("held count = %d; want %d", heldCount, tt.wantHeldCount)
			}
		})
	}
}

func TestDefaultSelectionAndSummariseMustAgree(t *testing.T) {
	// Verify that DefaultSelection() correctly identifies held rows and summarise() uses it.
	// Note: NeedsReview may not equal held count because exact duplicates are held but
	// not counted in NeedsReview (which tracks only score-based holds).
	rows := []Row{
		{Transaction: statement.Transaction{PostedDate: "2026-01-05"}}, // selected
		{Transaction: statement.Transaction{PostedDate: "2026-01-06"}, Duplicate: &Duplicate{Score: 8, Exact: false}}, // held
		{Transaction: statement.Transaction{PostedDate: "2026-01-07"}, Anomaly: &Anomaly{Score: 8}}, // held
		{Transaction: statement.Transaction{PostedDate: "2026-01-08"}, Duplicate: &Duplicate{Score: 3, Exact: true}}, // held (exact)
		{Transaction: statement.Transaction{PostedDate: "2026-01-09"}, Duplicate: &Duplicate{Score: 5}, Anomaly: &Anomaly{Score: 5}}, // selected
	}

	p := &Preview{Rows: rows}
	selected := p.DefaultSelection()
	selectedMap := make(map[int]bool)
	for _, idx := range selected {
		selectedMap[idx] = true
	}

	defaultRows := len(selected)

	p.summarise(HistoryStats{Rows: 10, AnomalyReady: true})

	if p.Summary.DefaultRows != defaultRows {
		t.Errorf("Summary.DefaultRows = %d; DefaultSelection returned %d", p.Summary.DefaultRows, defaultRows)
	}

	// Verify exact duplicates are held but separately counted
	expectedExactDuplicates := 1
	if p.Summary.ExactDuplicates != expectedExactDuplicates {
		t.Errorf("Summary.ExactDuplicates = %d; want %d", p.Summary.ExactDuplicates, expectedExactDuplicates)
	}

	// NeedsReview tracks score-based holds (duplicate/anomaly >= 8), not exact duplicates
	// Row 1 (dup score 8) and row 2 (anomaly score 8) should be in NeedsReview = 2
	expectedNeedsReview := 2
	if p.Summary.NeedsReview != expectedNeedsReview {
		t.Errorf("Summary.NeedsReview = %d; want %d", p.Summary.NeedsReview, expectedNeedsReview)
	}
}

func TestSetDefaultSelection(t *testing.T) {
	rows := []Row{
		{Transaction: statement.Transaction{PostedDate: "2026-01-05"}}, // selected
		{Transaction: statement.Transaction{PostedDate: "2026-01-06"}, Duplicate: &Duplicate{Score: 8, Exact: false}}, // held
		{Transaction: statement.Transaction{PostedDate: "2026-01-07"}, Anomaly: &Anomaly{Score: 7}}, // selected
		{Transaction: statement.Transaction{PostedDate: "2026-01-08"}, Duplicate: &Duplicate{Score: 3, Exact: true}}, // held
	}

	p := &Preview{Rows: rows}
	p.SetDefaultSelection()

	// Verify DefaultSelected flags are set correctly
	if !p.Rows[0].DefaultSelected {
		t.Error("row 0 should be default_selected")
	}
	if p.Rows[1].DefaultSelected {
		t.Error("row 1 should not be default_selected")
	}
	if !p.Rows[2].DefaultSelected {
		t.Error("row 2 should be default_selected")
	}
	if p.Rows[3].DefaultSelected {
		t.Error("row 3 should not be default_selected")
	}
}
