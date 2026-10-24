package importer

import (
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode"
)

// HistoryRow is the stored side of duplicate and anomaly comparison.
type HistoryRow struct {
	ID             int64
	PostedDate     time.Time
	Debit          int64
	Credit         int64
	Kind           string
	MerchantRaw    string
	DescriptionRaw string
	Fingerprint    string
}

// HistoryStats says whether stored rows are enough to compare against.
type HistoryStats struct {
	Rows         int
	AnomalyReady bool
	MedianDebit  int64
}

const minAnomalyHistory = 20

// Analyse fills the duplicate and anomaly signals on every row. Rows are
// compared against stored history and against earlier rows in the same file.
func Analyse(rows []Row, history []HistoryRow) HistoryStats {
	byFingerprint := make(map[string]HistoryRow, len(history))
	byAmount := make(map[string][]HistoryRow, len(history))
	merchants := make(map[string]bool, len(history))
	var debits []int64

	for _, h := range history {
		byFingerprint[h.Fingerprint] = h
		key := amountKey(h.Debit, h.Credit)
		if key != "" {
			byAmount[key] = append(byAmount[key], h)
		}
		if m := normalise(h.MerchantRaw); m != "" {
			merchants[m] = true
		}
		if h.Debit > 0 && countsAsSpending(h.Kind) {
			debits = append(debits, h.Debit)
		}
	}

	stats := HistoryStats{Rows: len(history)}
	if len(debits) >= minAnomalyHistory {
		stats.AnomalyReady = true
		stats.MedianDebit = median(debits)
	}

	seen := make(map[string]bool, len(rows))
	for i := range rows {
		row := &rows[i]
		if seen[row.Fingerprint] {
			row.Duplicate = &Duplicate{
				Score:  10,
				Exact:  true,
				Reason: "the same row appears earlier in this statement",
			}
		} else if h, ok := byFingerprint[row.Fingerprint]; ok {
			row.Duplicate = &Duplicate{
				Score:   10,
				Exact:   true,
				Reason:  "this row is already imported",
				Matches: []int64{h.ID},
			}
		} else if key := amountKey(row.Debit, row.Credit); key != "" {
			row.Duplicate = fuzzyDuplicate(row, byAmount[key])
		}
		seen[row.Fingerprint] = true

		if stats.AnomalyReady {
			row.Anomaly = anomaly(row, merchants, stats.MedianDebit)
		}
	}
	return stats
}

func fuzzyDuplicate(row *Row, candidates []HistoryRow) *Duplicate {
	day, err := time.Parse(time.DateOnly, row.PostedDate)
	if err != nil {
		return nil
	}
	best := 0
	reason := ""
	var matches []int64
	for _, h := range candidates {
		days := int(day.Sub(h.PostedDate).Hours() / 24)
		if days < 0 {
			days = -days
		}
		if days > 3 {
			continue
		}
		score := 4
		why := "same amount"
		switch days {
		case 0:
			score += 2
			why += " on the same day"
		case 1:
			score++
			why += " one day apart"
		default:
			why += fmt.Sprintf(" %d days apart", days)
		}
		if m := normalise(row.MerchantRaw); m != "" && m == normalise(h.MerchantRaw) {
			score += 2
			why += ", same merchant"
		}
		if descriptionSimilarity(row.DescriptionRaw, h.DescriptionRaw) >= 0.6 {
			score++
			why += ", similar description"
		}
		if score > 10 {
			score = 10
		}
		if score > best {
			best, reason = score, why
		}
		matches = append(matches, h.ID)
	}
	if best == 0 {
		return nil
	}
	if len(matches) > 5 {
		matches = matches[:5]
	}
	return &Duplicate{Score: best, Reason: reason, Matches: matches}
}

func anomaly(row *Row, merchants map[string]bool, medianDebit int64) *Anomaly {
	if row.Debit <= 0 {
		return nil
	}
	score, reasons := 0, []string{}
	merchant := normalise(row.MerchantRaw)
	if merchant != "" && !merchants[merchant] {
		score += 4
		reasons = append(reasons, "first payment to this merchant")
	}
	if medianDebit > 0 {
		switch {
		case row.Debit >= 5*medianDebit:
			score += 4
			reasons = append(reasons, "amount is more than five times your usual purchase")
		case row.Debit >= 3*medianDebit:
			score += 2
			reasons = append(reasons, "amount is more than three times your usual purchase")
		}
	}
	if score == 0 {
		return nil
	}
	if score > 10 {
		score = 10
	}
	return &Anomaly{Score: score, Reason: strings.Join(reasons, "; ")}
}

func amountKey(debit, credit int64) string {
	switch {
	case debit > 0:
		return fmt.Sprintf("d%d", debit)
	case credit > 0:
		return fmt.Sprintf("c%d", credit)
	}
	return ""
}

func countsAsSpending(kind string) bool {
	switch kind {
	case "card_purchase", "online_purchase", "intl_purchase", "bill_payment",
		"cash_withdrawal", "fee":
		return true
	}
	return false
}

func median(values []int64) int64 {
	sorted := append([]int64(nil), values...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
	mid := len(sorted) / 2
	if len(sorted)%2 == 1 {
		return sorted[mid]
	}
	return (sorted[mid-1] + sorted[mid]) / 2
}

func normalise(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// descriptionSimilarity is the share of shared words. Words of one letter are
// ignored because card terminals pad descriptions with stray letters.
func descriptionSimilarity(a, b string) float64 {
	aw, bw := words(a), words(b)
	if len(aw) == 0 || len(bw) == 0 {
		return 0
	}
	common := 0
	for w := range aw {
		if bw[w] {
			common++
		}
	}
	return float64(common) / float64(len(aw)+len(bw)-common)
}

func words(s string) map[string]bool {
	out := make(map[string]bool)
	for _, w := range strings.FieldsFunc(strings.ToLower(s), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	}) {
		if len([]rune(w)) > 1 {
			out[w] = true
		}
	}
	return out
}
