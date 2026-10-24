package importer

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// BackfillMerchants resolves merchant_id for all transactions where merchant_id
// is null and merchant_raw is non-empty. It uses the same normalizer and BNPL
// logic as the import commit, so the results are consistent.
//
// The operation is idempotent: it only touches rows where merchant_id is null.
// It runs in batches to keep memory use safe on large tables.
func BackfillMerchants(ctx context.Context, pool *pgxpool.Pool) error {
	const batchSize = 1000

	for {
		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("begin transaction: %w", err)
		}

		var count int
		err = tx.QueryRow(ctx, `
			select count(*) from transaction
			where merchant_id is null and merchant_raw != ''`).Scan(&count)
		if err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("count unresolved: %w", err)
		}
		if count == 0 {
			tx.Rollback(ctx)
			return nil
		}

		rows, err := tx.Query(ctx, `
			select id, merchant_raw, biller_code, biller_account
			from transaction
			where merchant_id is null and merchant_raw != ''
			limit $1`, batchSize)
		if err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("query batch: %w", err)
		}

		var updates []struct {
			txID       int64
			merchantID int64
		}

		for rows.Next() {
			var txID int64
			var merchantRaw string
			var billerCode, billerAccount string
			if err := rows.Scan(&txID, &merchantRaw, &billerCode, &billerAccount); err != nil {
				rows.Close()
				tx.Rollback(ctx)
				return fmt.Errorf("scan row: %w", err)
			}

			merchantID, err := resolveMerchantInTx(ctx, tx, merchantRaw, billerCode, billerAccount)
			if err != nil {
				rows.Close()
				tx.Rollback(ctx)
				return fmt.Errorf("resolve merchant for tx %d: %w", txID, err)
			}

			updates = append(updates, struct {
				txID       int64
				merchantID int64
			}{txID, merchantID})
		}
		rows.Close()

		for _, u := range updates {
			_, err := tx.Exec(ctx, `
				update transaction set merchant_id = $1
				where id = $2 and merchant_id is null`,
				u.merchantID, u.txID)
			if err != nil {
				tx.Rollback(ctx)
				return fmt.Errorf("update transaction %d: %w", u.txID, err)
			}
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit batch: %w", err)
		}

		if len(updates) < batchSize {
			return nil
		}
	}
}

// resolveMerchantInTx finds or creates a merchant within a transaction.
// It mirrors the logic in Store.findOrCreateMerchant but works with any pgx.Tx.
func resolveMerchantInTx(ctx context.Context, tx pgx.Tx, merchantRaw, billerCode, billerAccount string) (int64, error) {
	if billerCode != "" && billerAccount != "" {
		var id int64
		err := tx.QueryRow(ctx, `
			select id from merchant
			where biller_code = $1 and biller_account = $2`,
			billerCode, billerAccount).Scan(&id)
		if err == nil {
			return id, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return 0, fmt.Errorf("find merchant by biller: %w", err)
		}
	}

	canonical := NormalizeMerchant(merchantRaw)
	var id int64
	err := tx.QueryRow(ctx, `
		select id from merchant where canonical_name = $1`,
		canonical).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return 0, fmt.Errorf("find merchant by name: %w", err)
	}

	isBNPL := IsBNPLMerchant(canonical)
	err = tx.QueryRow(ctx, `
		insert into merchant (canonical_name, biller_code, biller_account, is_bnpl)
		values ($1, nullif($2, ''), nullif($3, ''), $4)
		returning id`,
		canonical, billerCode, billerAccount, isBNPL).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("create merchant: %w", err)
	}

	if merchantRaw != canonical {
		_, err := tx.Exec(ctx, `
			insert into merchant_alias (merchant_id, raw)
			values ($1, $2)
			on conflict (raw) do nothing`,
			id, merchantRaw)
		if err != nil {
			return 0, fmt.Errorf("create alias: %w", err)
		}
	}

	return id, nil
}
