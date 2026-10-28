package ledger

import (
	"context"
	"errors"
	"fmt"
)

var (
	ErrNotFound    = errors.New("not found")
	ErrBadCategory = errors.New("unknown category")
)

type Category struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func (s *Store) Categories(ctx context.Context) ([]Category, error) {
	rows, err := s.db.Query(ctx, `select id, name from category order by name, id`)
	if err != nil {
		return nil, fmt.Errorf("read categories: %w", err)
	}
	defer rows.Close()
	out := []Category{}
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.Name); err != nil {
			return nil, fmt.Errorf("read category row: %w", err)
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// SetCategory updates one row, and every row of the same merchant when
// applyToMerchant is set. A null category clears it.
func (s *Store) SetCategory(ctx context.Context, transactionID int64, categoryID *int64, applyToMerchant bool) error {
	if categoryID != nil {
		var exists bool
		if err := s.db.QueryRow(ctx,
			`select exists(select 1 from category where id = $1)`, *categoryID).Scan(&exists); err != nil {
			return fmt.Errorf("check category: %w", err)
		}
		if !exists {
			return ErrBadCategory
		}
	}
	tag, err := s.db.Exec(ctx, `
		with target as (select merchant_id from transaction where id = $2)
		update transaction t
		set category_id = $1
		where t.id = $2
		   or ($3 and t.merchant_id is not null
		       and t.merchant_id = (select merchant_id from target))`,
		categoryID, transactionID, applyToMerchant)
	if err != nil {
		return fmt.Errorf("update category: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SetMerchantAlias stores the display name shown for a merchant. A null alias
// falls back to the canonical name.
func (s *Store) SetMerchantAlias(ctx context.Context, merchantID int64, alias *string) error {
	tag, err := s.db.Exec(ctx,
		`update merchant set display_name = $1 where id = $2`, alias, merchantID)
	if err != nil {
		return fmt.Errorf("update merchant alias: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
