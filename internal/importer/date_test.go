package importer

import (
	"errors"
	"testing"
	"time"
)

func TestParseStatementDate(t *testing.T) {
	tests := []struct {
		input    string
		wantErr  bool
		wantDate time.Time
	}{
		// DD/MM/YYYY format (Alinma)
		{
			input:    "01/01/2026",
			wantErr:  false,
			wantDate: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			input:    "31/03/2026",
			wantErr:  false,
			wantDate: time.Date(2026, 3, 31, 0, 0, 0, 0, time.UTC),
		},
		{
			input:    "25/09/2025",
			wantErr:  false,
			wantDate: time.Date(2025, 9, 25, 0, 0, 0, 0, time.UTC),
		},
		{
			input:    "29/02/2024",
			wantErr:  false,
			wantDate: time.Date(2024, 2, 29, 0, 0, 0, 0, time.UTC),
		},
		// YYYY/MM/DD format (Al Rajhi)
		{
			input:    "2026/01/01",
			wantErr:  false,
			wantDate: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			input:    "2026/03/31",
			wantErr:  false,
			wantDate: time.Date(2026, 3, 31, 0, 0, 0, 0, time.UTC),
		},
		{
			input:    "2025/09/25",
			wantErr:  false,
			wantDate: time.Date(2025, 9, 25, 0, 0, 0, 0, time.UTC),
		},
		// YYYY-MM-DD format (ISO)
		{
			input:    "2026-01-01",
			wantErr:  false,
			wantDate: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		},
		{
			input:    "2026-03-31",
			wantErr:  false,
			wantDate: time.Date(2026, 3, 31, 0, 0, 0, 0, time.UTC),
		},
		{
			input:    "2025-09-25",
			wantErr:  false,
			wantDate: time.Date(2025, 9, 25, 0, 0, 0, 0, time.UTC),
		},
		// Empty string
		{
			input:    "",
			wantErr:  false,
			wantDate: time.Time{},
		},
		// Invalid dates
		{
			input:   "31/02/2026",
			wantErr: true,
		},
		{
			input:   "31/04/2026",
			wantErr: true,
		},
		{
			input:   "00/01/2026",
			wantErr: true,
		},
		{
			input:   "32/01/2026",
			wantErr: true,
		},
		{
			input:   "01/13/2026",
			wantErr: true,
		},
		{
			input:   "2026/02/31",
			wantErr: true,
		},
		{
			input:   "2026/13/01",
			wantErr: true,
		},
		// Invalid formats
		{
			input:   "2026/01",
			wantErr: true,
		},
		{
			input:   "01/2026",
			wantErr: true,
		},
		{
			input:   "2026-01-01-01",
			wantErr: true,
		},
		{
			input:   "not a date",
			wantErr: true,
		},
		{
			input:   "01-02-2026",
			wantErr: true, // ambiguous format
		},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got, err := ParseStatementDate(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseStatementDate(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.wantDate {
				t.Errorf("ParseStatementDate(%q) = %v, want %v", tt.input, got, tt.wantDate)
			}
			if tt.wantErr && !errors.Is(err, ErrInvalidDateFormat) {
				t.Errorf("ParseStatementDate(%q) error = %v, want ErrInvalidDateFormat", tt.input, err)
			}
		})
	}
}
