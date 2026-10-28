package ledger

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// Setting returns the stored value, or an empty string when the key is absent.
func (s *Store) Setting(ctx context.Context, key string) (string, error) {
	var value string
	err := s.db.QueryRow(ctx, `select value from app_setting where key = $1`, key).Scan(&value)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("read setting %q: %w", key, err)
	}
	return value, nil
}

func (s *Store) PutSetting(ctx context.Context, key, value string) error {
	_, err := s.db.Exec(ctx, `
		insert into app_setting (key, value) values ($1, $2)
		on conflict (key) do update set value = excluded.value`, key, value)
	if err != nil {
		return fmt.Errorf("write setting %q: %w", key, err)
	}
	return nil
}

// ClaimSetting writes value only when the stored value differs, so exactly one
// caller wins the claim.
func (s *Store) ClaimSetting(ctx context.Context, key, value string) (bool, error) {
	tag, err := s.db.Exec(ctx, `
		insert into app_setting (key, value) values ($1, $2)
		on conflict (key) do update set value = excluded.value
		where app_setting.value <> excluded.value`, key, value)
	if err != nil {
		return false, fmt.Errorf("claim setting %q: %w", key, err)
	}
	return tag.RowsAffected() == 1, nil
}
