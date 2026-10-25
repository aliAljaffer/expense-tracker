package ledger

import (
	"context"
	"testing"
)

func TestSettingRoundTrip(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()

	got, err := s.Setting(ctx, "reminder_email")
	if err != nil {
		t.Fatal(err)
	}
	if got != "" {
		t.Fatalf("missing key = %q, want empty", got)
	}

	if err := s.PutSetting(ctx, "reminder_email", "owner@example.com"); err != nil {
		t.Fatal(err)
	}
	if got, err = s.Setting(ctx, "reminder_email"); err != nil || got != "owner@example.com" {
		t.Fatalf("value = %q, err = %v", got, err)
	}

	if err := s.PutSetting(ctx, "reminder_email", "new@example.com"); err != nil {
		t.Fatal(err)
	}
	if got, err = s.Setting(ctx, "reminder_email"); err != nil || got != "new@example.com" {
		t.Fatalf("upserted value = %q, err = %v", got, err)
	}
}
