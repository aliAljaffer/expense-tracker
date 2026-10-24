package importer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aliAljaffer/grooszy/parsers/statement"
)

var (
	ErrNotFound     = errors.New("import not found")
	ErrNotPending   = errors.New("import is not waiting for review")
	ErrNoPreview    = errors.New("import preview expired")
	ErrNoAccount    = errors.New("statement does not identify an account")
	ErrUnsupported  = errors.New("unsupported file type")
	ErrUnreadable   = errors.New("file could not be parsed")
	ErrBadSelection = errors.New("invalid row selection")
)

// ImportRecord is the stored state of one statement import.
type ImportRecord struct {
	ID             int64
	AccountID      int64
	Bank           string
	AccountNumber  string
	IBAN           string
	Status         string
	Parser         string
	ParserVersion  string
	PeriodStart    *string
	PeriodEnd      *string
	ParsedRowCount int
	Reconciliation statement.Reconciliation
}

type ImportInput struct {
	AccountID      int64
	FileSHA256     string
	Parser         string
	ParserVersion  string
	PeriodStart    string
	PeriodEnd      string
	RowCount       int
	Statement      *statement.Statement
	Reconciliation statement.Reconciliation
	Accepted       bool
}

type CommitResult struct {
	ImportID int64 `json:"import_id"`
	Inserted int   `json:"inserted"`
	Skipped  int   `json:"skipped"`
}

type Store struct {
	pool *pgxpool.Pool
}

func Open(ctx context.Context, url string) (*Store, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

func (s *Store) Pool() *pgxpool.Pool { return s.pool }

// UpsertAccount keys the account on bank and number so a later statement for
// the same account attaches to the same rows.
func (s *Store) UpsertAccount(ctx context.Context, bank, number, iban string) (int64, error) {
	if bank == "" || number == "" {
		return 0, ErrNoAccount
	}
	var id int64
	err := s.pool.QueryRow(ctx, `
		insert into account (bank, number, iban, currency, kind)
		values ($1, $2, nullif($3, ''), 'SAR', 'current')
		on conflict (bank, number) do update set iban = coalesce(excluded.iban, account.iban)
		returning id`, bank, number, iban).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("upsert account: %w", err)
	}
	return id, nil
}

// ImportByHash returns the stored import for a file already seen, or ErrNotFound.
func (s *Store) ImportByHash(ctx context.Context, hash string) (*ImportRecord, error) {
	return s.scanImport(s.pool.QueryRow(ctx, `
		select i.id, i.account_id, a.bank, a.number, coalesce(a.iban, ''), i.status,
		       i.parser, i.parser_version, i.period_start::text, i.period_end::text,
		       i.parsed_row_count, i.reconciliation
		from statement_import i
		join account a on a.id = i.account_id
		where i.file_sha256 = $1`, hash))
}

func (s *Store) ImportByID(ctx context.Context, id int64) (*ImportRecord, error) {
	return s.scanImport(s.pool.QueryRow(ctx, `
		select i.id, i.account_id, a.bank, a.number, coalesce(a.iban, ''), i.status,
		       i.parser, i.parser_version, i.period_start::text, i.period_end::text,
		       i.parsed_row_count, i.reconciliation
		from statement_import i
		join account a on a.id = i.account_id
		where i.id = $1`, id))
}

func (s *Store) scanImport(row pgx.Row) (*ImportRecord, error) {
	var rec ImportRecord
	var recon []byte
	err := row.Scan(&rec.ID, &rec.AccountID, &rec.Bank, &rec.AccountNumber, &rec.IBAN,
		&rec.Status, &rec.Parser, &rec.ParserVersion, &rec.PeriodStart, &rec.PeriodEnd,
		&rec.ParsedRowCount, &recon)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("read import: %w", err)
	}
	if err := json.Unmarshal(recon, &rec.Reconciliation); err != nil {
		return nil, fmt.Errorf("decode reconciliation: %w", err)
	}
	return &rec, nil
}

func (s *Store) CreateImport(ctx context.Context, in ImportInput) (int64, error) {
	st := in.Statement
	status := "pending"
	if !in.Accepted {
		status = "rejected"
	}
	recon, err := json.Marshal(in.Reconciliation)
	if err != nil {
		return 0, err
	}
	var id int64
	err = s.pool.QueryRow(ctx, `
		insert into statement_import (
			account_id, file_sha256, parser, parser_version, period_start, period_end,
			opening_balance, closing_balance, stated_debit_total, stated_credit_total,
			stated_debit_count, stated_credit_count,
			parsed_debit_total, parsed_credit_total, parsed_debit_count, parsed_credit_count,
			parsed_row_count, reconciled, reconciliation, status
		) values (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
			$13, $14, $15, $16, $17, $18, $19, $20
		) returning id`,
		in.AccountID, in.FileSHA256, in.Parser, in.ParserVersion,
		nullIfEmpty(in.PeriodStart), nullIfEmpty(in.PeriodEnd),
		st.OpeningBalance, st.ClosingBalance, st.StatedDebitTotal, st.StatedCreditTotal,
		st.StatedDebitCount, st.StatedCreditCount,
		in.Reconciliation.DebitTotal, in.Reconciliation.CreditTotal,
		in.Reconciliation.DebitCount, in.Reconciliation.CreditCount,
		in.RowCount, in.Accepted, recon, status,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("create import: %w", err)
	}
	return id, nil
}

func (s *Store) SavePreview(ctx context.Context, importID int64, preview *Preview, expiresAt time.Time) error {
	payload, err := json.Marshal(preview)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		insert into import_preview (import_id, payload, expires_at)
		values ($1, $2, $3)
		on conflict (import_id) do update set payload = excluded.payload, expires_at = excluded.expires_at`,
		importID, payload, expiresAt)
	if err != nil {
		return fmt.Errorf("save preview: %w", err)
	}
	return nil
}

func (s *Store) LoadPreview(ctx context.Context, importID int64) (*Preview, error) {
	var payload []byte
	err := s.pool.QueryRow(ctx, `
		select payload from import_preview
		where import_id = $1 and expires_at > now()`, importID).Scan(&payload)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNoPreview
	}
	if err != nil {
		return nil, fmt.Errorf("load preview: %w", err)
	}
	var p Preview
	if err := json.Unmarshal(payload, &p); err != nil {
		return nil, fmt.Errorf("decode preview: %w", err)
	}
	return &p, nil
}

func (s *Store) History(ctx context.Context, accountID int64) ([]HistoryRow, error) {
	rows, err := s.pool.Query(ctx, `
		select id, posted_date, debit, credit, kind, coalesce(merchant_raw, ''),
		       description_raw, fingerprint
		from transaction where account_id = $1`, accountID)
	if err != nil {
		return nil, fmt.Errorf("read history: %w", err)
	}
	defer rows.Close()
	var out []HistoryRow
	for rows.Next() {
		var h HistoryRow
		if err := rows.Scan(&h.ID, &h.PostedDate, &h.Debit, &h.Credit, &h.Kind,
			&h.MerchantRaw, &h.DescriptionRaw, &h.Fingerprint); err != nil {
			return nil, fmt.Errorf("read history row: %w", err)
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

// Commit stores the chosen rows and accepts the import in one transaction.
func (s *Store) Commit(ctx context.Context, importID int64, preview *Preview, selected []int) (CommitResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return CommitResult{}, err
	}
	defer tx.Rollback(ctx)

	var status string
	var accountID int64
	if err := tx.QueryRow(ctx,
		`select status, account_id from statement_import where id = $1 for update`,
		importID).Scan(&status, &accountID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CommitResult{}, ErrNotFound
		}
		return CommitResult{}, err
	}
	if status != "pending" {
		return CommitResult{}, ErrNotPending
	}

	batch := &pgx.Batch{}
	for _, i := range selected {
		if i < 0 || i >= len(preview.Rows) {
			return CommitResult{}, fmt.Errorf("row %d is out of range", i)
		}
		t := preview.Rows[i].Transaction
		batch.Queue(`
			insert into transaction (
				account_id, import_id, posted_date, description_raw, debit, credit,
				balance_after, kind, merchant_raw, biller_code, biller_account,
				card_last4, fx_currency, fx_amount, fx_rate, fx_fee
			) values (
				$1, $2, $3, $4, $5, $6, $7, $8, nullif($9, ''), nullif($10, ''),
				nullif($11, ''), nullif($12, ''), nullif($13, ''), $14, $15, $16
			) on conflict (fingerprint) do nothing`,
			accountID, importID, t.PostedDate, t.DescriptionRaw, t.Debit, t.Credit,
			t.BalanceAfter, string(t.Kind), t.MerchantRaw, t.BillerCode, t.BillerAccount,
			t.CardLast4, t.FxCurrency, t.FxAmount, nullIfEmpty(t.FxRate), t.FxFee)
	}

	result := CommitResult{ImportID: importID}
	br := tx.SendBatch(ctx, batch)
	for range selected {
		tag, err := br.Exec()
		if err != nil {
			br.Close()
			return CommitResult{}, fmt.Errorf("insert transaction: %w", err)
		}
		if tag.RowsAffected() == 1 {
			result.Inserted++
		} else {
			result.Skipped++
		}
	}
	if err := br.Close(); err != nil {
		return CommitResult{}, fmt.Errorf("close batch: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`update statement_import set status = 'accepted' where id = $1`, importID); err != nil {
		return CommitResult{}, fmt.Errorf("accept import: %w", err)
	}
	if _, err := tx.Exec(ctx, `delete from import_preview where import_id = $1`, importID); err != nil {
		return CommitResult{}, fmt.Errorf("drop preview: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return CommitResult{}, fmt.Errorf("commit import: %w", err)
	}
	return result, nil
}

func (s *Store) Cancel(ctx context.Context, importID int64) error {
	tag, err := s.pool.Exec(ctx,
		`delete from statement_import where id = $1 and status = 'pending'`, importID)
	if err != nil {
		return fmt.Errorf("cancel import: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// DiscardRejected drops a rejected import so a corrected parser can try the
// same file again.
func (s *Store) DiscardRejected(ctx context.Context, importID int64) error {
	_, err := s.pool.Exec(ctx,
		`delete from statement_import where id = $1 and status = 'rejected'`, importID)
	if err != nil {
		return fmt.Errorf("discard rejected import: %w", err)
	}
	return nil
}

// Cleanup drops reviews the owner abandoned. Uploaded files are never stored,
// so only the pending row and its preview payload remain.
func (s *Store) Cleanup(ctx context.Context) error {
	_, err := s.pool.Exec(ctx,
		`delete from statement_import where status = 'pending' and created_at < now() - interval '24 hours'`)
	return err
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
