package explain

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/aliAljaffer/grooszy/internal/ledger"
)

func chatFixture() ([]ledger.Month, ledger.CardCoverageResult, ledger.RecurringResult, ledger.BNPLResult) {
	months := []ledger.Month{
		{
			Month:                 "2026-05",
			Income:                ledger.Income{Total: 900000},
			Spending:              ledger.Spending{Total: 350000},
			CardPayments:          120000,
			UncategorisedSpending: 40000,
			TransactionCount:      42,
		},
	}
	card := ledger.CardCoverageResult{Status: "ok", Summary: "One month had card payments without matching purchase statements."}
	recurring := ledger.RecurringResult{
		Status:  "ok",
		Summary: "One recurring payment found: STARBUCKS (35.00 SAR/month).",
	}
	recurring.Evidence.Series = []ledger.RecurringSeries{{Merchant: "STARBUCKS", MedianAmount: 3500}}
	bnpl := ledger.BNPLResult{Status: "ok", Summary: "BNPL commitments are stable or falling: 400.00 SAR this month vs 450.00 SAR average."}
	return months, card, recurring, bnpl
}

func TestChatInstructionStatesMoneyStyleAndNoInvention(t *testing.T) {
	for _, want := range []string{"Gersz", "3,500.00 SAR", "Never invent", "em dash"} {
		if !strings.Contains(chatInstruction, want) {
			t.Errorf("chat instruction is missing %q", want)
		}
	}
}

func TestChatSummaryDropsAccountNumberAndDescription(t *testing.T) {
	const (
		account     = "SA0000000001234567890123"
		description = "STARBUCKS RIYADH 4321"
	)
	months, card, recurring, bnpl := chatFixture()

	// The server holds richer rows than the packet. They stay out of it.
	number := account
	row := ledger.TransactionRow{Description: description}
	if !strings.Contains(recurring.Summary, "STARBUCKS") {
		t.Fatal("fixture must carry the merchant name for the test to mean anything")
	}

	packet, err := NewChatSummary(months, card, recurring, bnpl).packet()
	if err != nil {
		t.Fatal(err)
	}
	for _, banned := range []string{number, row.Description, "STARBUCKS", "4321", "transaction_ids", "balance"} {
		if strings.Contains(packet, banned) {
			t.Errorf("packet leaked %q: %s", banned, packet)
		}
	}
	for _, want := range []string{"2026-05", "3,500.00 SAR", "recurring payments found"} {
		if !strings.Contains(packet, want) {
			t.Errorf("packet is missing %q: %s", want, packet)
		}
	}
}

func TestAnswerFoldsConversationIntoOneUserTurn(t *testing.T) {
	srv, got := captureServer(t, func(w http.ResponseWriter) {
		w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"You spent 3,500.00 SAR in May."}}]}`))
	})
	e := New(Config{Provider: ProviderOpenAI, BaseURL: srv.URL, Model: "m1", APIKey: "k1", Enabled: true})
	months, card, recurring, bnpl := chatFixture()

	reply, err := e.Answer(context.Background(), NewChatSummary(months, card, recurring, bnpl), []ChatMessage{
		{Role: "user", Content: "How much did I spend in May?"},
		{Role: "assistant", Content: "You spent 3,500.00 SAR."},
		{Role: "user", Content: "Where can I cut back?"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if reply != "You spent 3,500.00 SAR in May." {
		t.Fatalf("reply = %q", reply)
	}

	sent, _ := got.get()
	raw, ok := sent["messages"].([]any)
	if !ok || len(raw) != 2 {
		t.Fatalf("messages = %v, want a system and one user turn", sent["messages"])
	}
	system := raw[0].(map[string]any)
	user := raw[1].(map[string]any)
	if system["role"] != "system" || system["content"] != chatInstruction {
		t.Fatalf("system message = %v", system)
	}
	if user["role"] != "user" {
		t.Fatalf("second message role = %v", user["role"])
	}
	content, _ := user["content"].(string)
	for _, want := range []string{"Summary of the owner's last six months", "How much did I spend in May?",
		"assistant: You spent 3,500.00 SAR.", "user: Where can I cut back?"} {
		if !strings.Contains(content, want) {
			t.Errorf("user turn is missing %q: %s", want, content)
		}
	}
}
