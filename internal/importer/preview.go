package importer

import (
	"fmt"
	"time"

	"github.com/aliAljaffer/grooszy/parsers/statement"
)

// Row is one parsed transaction with the review signals shown before commit.
type Row struct {
	statement.Transaction
	Fingerprint     string     `json:"fingerprint"`
	Duplicate       *Duplicate `json:"duplicate,omitempty"`
	Anomaly         *Anomaly   `json:"anomaly,omitempty"`
	DefaultSelected bool       `json:"default_selected"`
}

// Duplicate scores how likely the row is a repeat of one already stored.
// Exact means the stored fingerprint is identical, so the row cannot be
// inserted. Score is a review aid, never proof of a duplicate.
type Duplicate struct {
	Score   int     `json:"score"`
	Exact   bool    `json:"exact"`
	Reason  string  `json:"reason"`
	Matches []int64 `json:"matches,omitempty"`
}

// Anomaly scores how unusual the row is against stored history. It is not a
// fraud signal.
type Anomaly struct {
	Score  int    `json:"score"`
	Reason string `json:"reason"`
}

type Header struct {
	OpeningBalance    *int64 `json:"opening_balance,omitempty"`
	ClosingBalance    *int64 `json:"closing_balance,omitempty"`
	StatedDebitTotal  *int64 `json:"stated_debit_total,omitempty"`
	StatedCreditTotal *int64 `json:"stated_credit_total,omitempty"`
	StatedDebitCount  *int   `json:"stated_debit_count,omitempty"`
	StatedCreditCount *int   `json:"stated_credit_count,omitempty"`
}

type Summary struct {
	Rows            int  `json:"rows"`
	ExactDuplicates int  `json:"exact_duplicates"`
	NeedsReview     int  `json:"needs_review"`
	DefaultRows     int  `json:"default_rows"`
	HistoryRows     int  `json:"history_rows"`
	AnomalyReady    bool `json:"anomaly_ready"`
}

type Preview struct {
	ImportID        int64                    `json:"import_id"`
	Status          string                   `json:"status"`
	AlreadyImported bool                     `json:"already_imported"`
	Bank            string                   `json:"bank"`
	AccountNumber   string                   `json:"account_number"`
	IBAN            string                   `json:"iban,omitempty"`
	Parser          string                   `json:"parser"`
	ParserVersion   string                   `json:"parser_version"`
	PeriodStart     string                   `json:"period_start,omitempty"`
	PeriodEnd       string                   `json:"period_end,omitempty"`
	Header          Header                   `json:"header"`
	Reconciliation  statement.Reconciliation `json:"reconciliation"`
	Rows            []Row                    `json:"rows"`
	Summary         Summary                  `json:"summary"`
}

// reviewThreshold is the score at which a row is held for the owner instead of
// being selected by default.
const reviewThreshold = 8

// DefaultSelection lists the row indexes a commit stores when the owner does
// not choose: every row that is neither an exact duplicate nor held for review.
func (p *Preview) DefaultSelection() []int {
	rows := make([]int, 0, len(p.Rows))
	for i := range p.Rows {
		if p.Rows[i].Duplicate != nil && p.Rows[i].Duplicate.Exact {
			continue
		}
		if p.Rows[i].Duplicate != nil && p.Rows[i].Duplicate.Score >= reviewThreshold {
			continue
		}
		if p.Rows[i].Anomaly != nil && p.Rows[i].Anomaly.Score >= reviewThreshold {
			continue
		}
		rows = append(rows, i)
	}
	return rows
}

// SetDefaultSelection populates the DefaultSelected flag on each row.
func (p *Preview) SetDefaultSelection() {
	selected := p.DefaultSelection()
	selectedMap := make(map[int]bool, len(selected))
	for _, i := range selected {
		selectedMap[i] = true
	}
	for i := range p.Rows {
		p.Rows[i].DefaultSelected = selectedMap[i]
	}
}

func (p *Preview) summarise(stats HistoryStats) {
	p.Summary = Summary{
		Rows:         len(p.Rows),
		HistoryRows:  stats.Rows,
		AnomalyReady: stats.AnomalyReady,
	}
	for i := range p.Rows {
		if p.Rows[i].Duplicate != nil && p.Rows[i].Duplicate.Exact {
			p.Summary.ExactDuplicates++
		}
		if (p.Rows[i].Duplicate != nil && p.Rows[i].Duplicate.Score >= reviewThreshold) ||
			(p.Rows[i].Anomaly != nil && p.Rows[i].Anomaly.Score >= reviewThreshold) {
			p.Summary.NeedsReview++
		}
	}
	p.Summary.DefaultRows = len(p.DefaultSelection())
}

// buildRows validates a parse and attaches fingerprints. It rejects a row the
// database would reject, before the owner spends time reviewing it.
func buildRows(accountID int64, s *statement.Statement) ([]Row, error) {
	rows := make([]Row, 0, len(s.Transactions))
	for i, t := range s.Transactions {
		if t.Debit < 0 || t.Credit < 0 || (t.Debit > 0 && t.Credit > 0) {
			return nil, fmt.Errorf("row %d has invalid amounts", i+1)
		}
		if _, err := time.Parse(time.DateOnly, t.PostedDate); err != nil {
			return nil, fmt.Errorf("row %d has an invalid posted date", i+1)
		}
		fp, err := Fingerprint(accountID, t)
		if err != nil {
			return nil, err
		}
		rows = append(rows, Row{Transaction: t, Fingerprint: fp})
	}
	return rows, nil
}

func newPreview(rec *ImportRecord) *Preview {
	return &Preview{
		ImportID:       rec.ID,
		Status:         rec.Status,
		Bank:           rec.Bank,
		AccountNumber:  rec.AccountNumber,
		IBAN:           rec.IBAN,
		Parser:         rec.Parser,
		ParserVersion:  rec.ParserVersion,
		PeriodStart:    deref(rec.PeriodStart),
		PeriodEnd:      deref(rec.PeriodEnd),
		Reconciliation: rec.Reconciliation,
		Summary:        Summary{Rows: rec.ParsedRowCount},
		Rows:           []Row{},
	}
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
