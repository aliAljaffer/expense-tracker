// Package importer turns a bank export into a reviewable preview and stores
// the approved rows. Parsing, reconciliation and duplicate detection all run
// in process; the uploaded file is never written to disk.
package importer

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/aliAljaffer/grooszy/parsers/alinma"
	"github.com/aliAljaffer/grooszy/parsers/alrajhi"
	"github.com/aliAljaffer/grooszy/parsers/statement"
)

const previewTTL = 24 * time.Hour

type Service struct {
	store *Store
	now   func() time.Time
	parse func([]byte) (*statement.Statement, error)
}

func NewService(store *Store) *Service {
	return &Service{store: store, now: time.Now, parse: Parse}
}

func (s *Service) Ping(ctx context.Context) error { return s.store.Ping(ctx) }

// Parse picks the parser from the file bytes, not the file name: a renamed
// export must not reach the wrong parser.
func Parse(data []byte) (*statement.Statement, error) {
	switch {
	case bytes.HasPrefix(data, []byte("%PDF-")):
		st, err := alrajhi.Parse(data)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrUnreadable, err)
		}
		return st, nil
	case bytes.HasPrefix(data, []byte("PK\x03\x04")):
		st, err := alinma.Parse(data)
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrUnreadable, err)
		}
		return st, nil
	default:
		return nil, ErrUnsupported
	}
}

// Upload parses a statement and returns the review preview. A statement that
// does not reconcile is stored as rejected and returned with status rejected;
// it can never be committed.
func (s *Service) Upload(ctx context.Context, data []byte) (*Preview, error) {
	sum := sha256.Sum256(data)
	hash := hex.EncodeToString(sum[:])

	if rec, err := s.store.ImportByHash(ctx, hash); err == nil {
		switch rec.Status {
		case "pending":
			if p, err := s.store.LoadPreview(ctx, rec.ID); err == nil {
				p.Resumed = true
				p.SetDefaultSelection()
				return p, nil
			}
			if err := s.store.Cancel(ctx, rec.ID); err != nil {
				return nil, err
			}
		case "rejected":
			if err := s.store.DiscardRejected(ctx, rec.ID); err != nil {
				return nil, err
			}
		default:
			p := newPreview(rec)
			p.AlreadyImported = true
			return p, nil
		}
	} else if !errors.Is(err, ErrNotFound) {
		return nil, err
	}

	st, err := s.parse(data)
	if err != nil {
		return nil, err
	}
	recon := st.Reconcile()

	accountID, err := s.store.UpsertAccount(ctx, st.Bank, st.AccountNumber, st.IBAN)
	if err != nil {
		return nil, err
	}
	rows, err := buildRows(accountID, st)
	if err != nil {
		return nil, err
	}
	if err := s.store.applyMerchantAliases(ctx, rows); err != nil {
		return nil, err
	}

	// Parse and normalize period dates from the statement
	periodStart, err := ParseStatementDate(st.PeriodStart)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrBadPeriod, err)
	}
	periodEnd, err := ParseStatementDate(st.PeriodEnd)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrBadPeriod, err)
	}

	importID, err := s.store.CreateImport(ctx, ImportInput{
		AccountID:      accountID,
		FileSHA256:     hash,
		Parser:         st.Parser,
		ParserVersion:  st.ParserVersion,
		PeriodStart:    periodStart.Format("2006-01-02"),
		PeriodEnd:      periodEnd.Format("2006-01-02"),
		RowCount:       len(rows),
		Statement:      st,
		Reconciliation: recon,
		Accepted:       recon.OK,
	})
	if err != nil {
		return nil, err
	}

	p := &Preview{
		ImportID:       importID,
		Status:         "pending",
		Bank:           st.Bank,
		AccountNumber:  st.AccountNumber,
		IBAN:           st.IBAN,
		Parser:         st.Parser,
		ParserVersion:  st.ParserVersion,
		PeriodStart:    periodStart.Format("2006-01-02"),
		PeriodEnd:      periodEnd.Format("2006-01-02"),
		Reconciliation: recon,
		Header: Header{
			OpeningBalance:    st.OpeningBalance,
			ClosingBalance:    st.ClosingBalance,
			StatedDebitTotal:  st.StatedDebitTotal,
			StatedCreditTotal: st.StatedCreditTotal,
			StatedDebitCount:  st.StatedDebitCount,
			StatedCreditCount: st.StatedCreditCount,
		},
		Rows: rows,
	}

	if !recon.OK {
		p.Status = "rejected"
		p.summarise(HistoryStats{})
		p.SetDefaultSelection()
		return p, nil
	}

	history, err := s.store.History(ctx, accountID)
	if err != nil {
		return nil, err
	}
	stats := Analyse(p.Rows, history)
	p.summarise(stats)
	p.SetDefaultSelection()

	if err := s.store.SavePreview(ctx, importID, p, s.now().Add(previewTTL)); err != nil {
		return nil, err
	}
	return p, nil
}

// Get returns the stored preview of a pending import, or the summary of a
// finished one.
func (s *Service) Get(ctx context.Context, importID int64) (*Preview, error) {
	rec, err := s.store.ImportByID(ctx, importID)
	if err != nil {
		return nil, err
	}
	if rec.Status != "pending" {
		return newPreview(rec), nil
	}
	p, err := s.store.LoadPreview(ctx, importID)
	if err != nil {
		return nil, err
	}
	p.SetDefaultSelection()
	return p, nil
}

// Commit stores the selected rows and accepts the import. A nil selection
// stores the default set.
func (s *Service) Commit(ctx context.Context, importID int64, selected []int) (CommitResult, error) {
	rec, err := s.store.ImportByID(ctx, importID)
	if err != nil {
		return CommitResult{}, err
	}
	if rec.Status != "pending" {
		return CommitResult{}, ErrNotPending
	}
	preview, err := s.store.LoadPreview(ctx, importID)
	if err != nil {
		return CommitResult{}, err
	}
	if selected == nil {
		selected = preview.DefaultSelection()
	}
	seen := make(map[int]bool, len(selected))
	for _, i := range selected {
		if i < 0 || i >= len(preview.Rows) {
			return CommitResult{}, fmt.Errorf("%w: row %d is out of range", ErrBadSelection, i)
		}
		if seen[i] {
			return CommitResult{}, fmt.Errorf("%w: row %d is listed twice", ErrBadSelection, i)
		}
		seen[i] = true
	}
	return s.store.Commit(ctx, importID, preview, selected)
}

func (s *Service) Cancel(ctx context.Context, importID int64) error {
	return s.store.Cancel(ctx, importID)
}

func (s *Service) Cleanup(ctx context.Context) error {
	return s.store.Cleanup(ctx)
}
