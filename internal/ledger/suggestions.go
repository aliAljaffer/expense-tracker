package ledger

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aliAljaffer/grooszy/internal/importer"
)

const (
	minRecurringCount      = 3
	minRecurringMonths     = 3
	amountTolerancePercent = 20
	maxGapDays             = 45
)

func isBNPLMerchant(name string) bool {
	return importer.IsBNPLMerchant(name)
}

type CardCoverageMonth struct {
	Month             string  `json:"month"`
	CardPayments      int64   `json:"card_payments"`
	PurchasesRecorded int64   `json:"purchases_recorded"`
	Uncovered         int64   `json:"uncovered"`
	UncoveredShare    float64 `json:"uncovered_share"`
	TransactionIDs    []int64 `json:"transaction_ids"`
}

type CardCoverageResult struct {
	Status string `json:"status"`
	Period struct {
		From string `json:"from"`
		To   string `json:"to"`
	} `json:"period"`
	Summary  string `json:"summary"`
	Evidence struct {
		Months []CardCoverageMonth `json:"months"`
	} `json:"evidence"`
	Limits   string `json:"limits"`
	NextStep string `json:"next_step"`
	Decision string `json:"decision"`
}

func (s *Store) CardCoverage(ctx context.Context, fromMonth, toMonth string) (CardCoverageResult, error) {
	var out CardCoverageResult
	out.Evidence.Months = []CardCoverageMonth{}
	out.Period.From = fromMonth
	out.Period.To = toMonth
	decision, err := s.SuggestionDecision(ctx, SuggestionCardCoverage)
	if err != nil {
		return out, err
	}
	out.Decision = decision

	months, err := s.Monthly(ctx, fromMonth, toMonth)
	if err != nil {
		return out, err
	}

	for _, m := range months {
		if m.CreditCardCoverage.UncoveredShare > 0 {
			month := CardCoverageMonth{
				Month:             m.Month,
				CardPayments:      m.CardPayments,
				PurchasesRecorded: m.CreditCardCoverage.PurchasesRecorded,
				Uncovered:         m.CreditCardCoverage.Uncovered,
				UncoveredShare:    m.CreditCardCoverage.UncoveredShare,
				TransactionIDs:    []int64{},
			}

			rows, queryErr := s.db.QueryContext(ctx, `
				select id from transaction
				where kind = 'card_payment' and debit > 0
				  and account_id = (select account_id from transaction where posted_date = $1 limit 1)
				  and posted_date >= $1 and posted_date < $1::date + interval '1 month'
				order by posted_date`,
				m.Month+"-01")
			if queryErr != nil {
				return out, fmt.Errorf("read card payment ids: %w", queryErr)
			}
			for rows.Next() {
				var id int64
				if err := rows.Scan(&id); err != nil {
					rows.Close()
					return out, fmt.Errorf("scan card payment id: %w", err)
				}
				month.TransactionIDs = append(month.TransactionIDs, id)
			}
			rows.Close()
			out.Evidence.Months = append(out.Evidence.Months, month)
		}
	}

	if len(out.Evidence.Months) == 0 {
		out.Status = "insufficient_data"
		out.Summary = "No card payments found in the period."
		out.Limits = "Requires at least one month with card payments."
		out.NextStep = "Import a bank statement with card payment rows."
		return out, nil
	}

	out.Status = "ok"
	count := len(out.Evidence.Months)
	if count == 1 {
		out.Summary = "One month had card payments without matching purchase statements."
	} else {
		out.Summary = fmt.Sprintf("%d of %d months had card payments without matching purchase statements.", count, len(months))
	}
	out.Limits = "Does not account for manually entered card statements or categories."
	out.NextStep = fmt.Sprintf("Import the card statement for %s.", out.Evidence.Months[0].Month)

	return out, nil
}

type RecurringSeries struct {
	Merchant       string  `json:"merchant"`
	MerchantID     int64   `json:"merchant_id"`
	Count          int64   `json:"occurrence_count"`
	DistinctMonths int64   `json:"distinct_months"`
	MedianAmount   int64   `json:"median_amount"`
	TotalAmount    int64   `json:"total_amount"`
	FirstDate      string  `json:"first_date"`
	LastDate       string  `json:"last_date"`
	CadenceDays    *int64  `json:"cadence_days"`
	TransactionIDs []int64 `json:"transaction_ids"`
}

type RecurringResult struct {
	Status string `json:"status"`
	Period struct {
		From string `json:"from"`
		To   string `json:"to"`
	} `json:"period"`
	Summary  string `json:"summary"`
	Evidence struct {
		Series []RecurringSeries `json:"recurring_series"`
	} `json:"evidence"`
	Limits   string `json:"limits"`
	NextStep string `json:"next_step"`
	Decision string `json:"decision"`
}

func (s *Store) Recurring(ctx context.Context, fromMonth, toMonth string) (RecurringResult, error) {
	var out RecurringResult
	out.Evidence.Series = []RecurringSeries{}
	out.Period.From = fromMonth
	out.Period.To = toMonth

	decision, err := s.SuggestionDecision(ctx, SuggestionRecurring)
	if err != nil {
		return out, err
	}
	out.Decision = decision

	from, err := time.Parse("2006-01", fromMonth)
	if err != nil {
		return out, fmt.Errorf("%w: from must be YYYY-MM", ErrBadFilter)
	}
	to, err := time.Parse("2006-01", toMonth)
	if err != nil {
		return out, fmt.Errorf("%w: to must be YYYY-MM", ErrBadFilter)
	}
	if from.After(to) {
		return out, fmt.Errorf("%w: from month is after to month", ErrBadFilter)
	}
	first := from.Format("2006-01-02")
	last := time.Date(to.Year(), to.Month(), 1, 0, 0, 0, 0, time.UTC).
		AddDate(0, 1, 0).AddDate(0, 0, -1).Format("2006-01-02")

	rows, err := s.db.QueryContext(ctx, `
		select m.id, m.canonical_name,
		       count(distinct t.id),
		       count(distinct to_char(t.posted_date, 'YYYY-MM')),
		       percentile_cont(0.5) within group (order by t.debit),
		       sum(t.debit),
		       min(t.posted_date)::text,
		       max(t.posted_date)::text
		from transaction t
		join merchant m on t.merchant_id = m.id
		where t.debit > 0 and t.counts_as_spending
		  and t.posted_date >= $1::date and t.posted_date <= $2::date
		group by m.id, m.canonical_name
		having count(distinct t.id) >= $3 and count(distinct to_char(t.posted_date, 'YYYY-MM')) >= $4
		order by sum(t.debit) desc`,
		first, last, minRecurringCount, minRecurringMonths)
	if err != nil {
		return out, fmt.Errorf("read recurring: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var series RecurringSeries
		var median float64
		if err := rows.Scan(&series.MerchantID, &series.Merchant, &series.Count, &series.DistinctMonths,
			&median, &series.TotalAmount, &series.FirstDate, &series.LastDate); err != nil {
			return out, fmt.Errorf("read recurring row: %w", err)
		}
		series.MedianAmount = int64(math.Round(median))
		series.TransactionIDs = []int64{}

		dateAmountRows, dateErr := s.db.QueryContext(ctx, `
			select t.posted_date, t.debit from transaction t
			join merchant m on t.merchant_id = m.id
			where m.id = $1 and t.debit > 0 and t.counts_as_spending
			  and t.posted_date >= $2::date and t.posted_date <= $3::date
			order by t.posted_date`,
			series.MerchantID, first, last)
		if dateErr != nil {
			rows.Close()
			return out, fmt.Errorf("read recurring dates: %w", dateErr)
		}

		var dates []time.Time
		var amounts []int64
		for dateAmountRows.Next() {
			var d time.Time
			var amt int64
			if err := dateAmountRows.Scan(&d, &amt); err != nil {
				dateAmountRows.Close()
				rows.Close()
				return out, fmt.Errorf("scan recurring date: %w", err)
			}
			dates = append(dates, d)
			amounts = append(amounts, amt)
		}
		dateAmountRows.Close()

		if !isValidRecurringSeries(series.MedianAmount, dates, amounts, maxGapDays, amountTolerancePercent) {
			continue
		}

		cadenceDays := calculateCadenceDays(dates)
		if cadenceDays > 0 {
			series.CadenceDays = &cadenceDays
		}

		txRows, queryErr := s.db.QueryContext(ctx, `
			select t.id from transaction t
			join merchant m on t.merchant_id = m.id
			where m.id = $1 and t.debit > 0 and t.counts_as_spending
			  and t.posted_date >= $2::date and t.posted_date <= $3::date
			order by t.posted_date`,
			series.MerchantID, first, last)
		if queryErr != nil {
			rows.Close()
			return out, fmt.Errorf("read recurring transaction ids: %w", queryErr)
		}
		for txRows.Next() {
			var id int64
			if err := txRows.Scan(&id); err != nil {
				txRows.Close()
				rows.Close()
				return out, fmt.Errorf("scan recurring transaction id: %w", err)
			}
			series.TransactionIDs = append(series.TransactionIDs, id)
		}
		txRows.Close()
		out.Evidence.Series = append(out.Evidence.Series, series)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}

	if len(out.Evidence.Series) == 0 {
		out.Status = "insufficient_data"
		out.Summary = "No recurring payments found."
		out.Limits = "Recurring series must appear in at least 3 distinct months with at least 3 occurrences, stable amounts, and consistent cadence."
		out.NextStep = "Review recurring payments once more data is available."
		return out, nil
	}

	out.Status = "ok"
	count := len(out.Evidence.Series)
	largest := out.Evidence.Series[0]
	if count == 1 {
		out.Summary = fmt.Sprintf("One recurring payment found: %s (%s/month).", largest.Merchant, FormatHalalas(largest.MedianAmount))
	} else {
		out.Summary = fmt.Sprintf("%d recurring payments found. The largest is %s (%s/month).", count, largest.Merchant, FormatHalalas(largest.MedianAmount))
	}
	out.Limits = "Recurring series must appear in at least 3 distinct months with stable amounts and consistent cadence. May not detect recently started payments."
	out.NextStep = "Review and categorize the recurring payments."

	return out, nil
}

func isValidRecurringSeries(medianAmount int64, dates []time.Time, amounts []int64, maxGapDays int, tolerancePercent int) bool {
	if len(dates) < 3 || len(amounts) < 3 {
		return false
	}

	tolerance := (medianAmount * int64(tolerancePercent)) / 100
	minAmount := medianAmount - tolerance
	maxAmount := medianAmount + tolerance

	for _, amt := range amounts {
		if amt < minAmount || amt > maxAmount {
			return false
		}
	}

	for i := 0; i < len(dates)-1; i++ {
		gap := int(dates[i+1].Sub(dates[i]).Hours() / 24)
		if gap > maxGapDays {
			return false
		}
	}

	return true
}

func calculateCadenceDays(dates []time.Time) int64 {
	if len(dates) < 2 {
		return 0
	}

	var gaps []int64
	for i := 0; i < len(dates)-1; i++ {
		gap := int64(dates[i+1].Sub(dates[i]).Hours() / 24)
		gaps = append(gaps, gap)
	}

	if len(gaps) == 0 {
		return 0
	}

	sort.Slice(gaps, func(i, j int) bool { return gaps[i] < gaps[j] })
	return gaps[len(gaps)/2]
}

type BNPLMonth struct {
	Month             string  `json:"month"`
	BNPLOutflow       int64   `json:"bnpl_outflow"`
	PaymentCount      int64   `json:"payment_count"`
	PreviousMonth     *int64  `json:"previous_month"`
	ThreeMonthAverage *int64  `json:"three_month_average"`
	IsRising          bool    `json:"is_rising"`
	TransactionIDs    []int64 `json:"transaction_ids"`
}

type BNPLResult struct {
	Status string `json:"status"`
	Period struct {
		From string `json:"from"`
		To   string `json:"to"`
	} `json:"period"`
	Summary  string `json:"summary"`
	Evidence struct {
		Months []BNPLMonth `json:"months"`
	} `json:"evidence"`
	Limits   string `json:"limits"`
	NextStep string `json:"next_step"`
	Decision string `json:"decision"`
}

func (s *Store) BNPL(ctx context.Context, fromMonth, toMonth string) (BNPLResult, error) {
	var out BNPLResult
	out.Evidence.Months = []BNPLMonth{}
	out.Period.From = fromMonth
	out.Period.To = toMonth

	decision, err := s.SuggestionDecision(ctx, SuggestionBNPL)
	if err != nil {
		return out, err
	}
	out.Decision = decision

	from, err := time.Parse("2006-01", fromMonth)
	if err != nil {
		return out, fmt.Errorf("%w: from must be YYYY-MM", ErrBadFilter)
	}
	to, err := time.Parse("2006-01", toMonth)
	if err != nil {
		return out, fmt.Errorf("%w: to must be YYYY-MM", ErrBadFilter)
	}
	if from.After(to) {
		return out, fmt.Errorf("%w: from month is after to month", ErrBadFilter)
	}
	first := from.Format("2006-01-02")
	last := time.Date(to.Year(), to.Month(), 1, 0, 0, 0, 0, time.UTC).
		AddDate(0, 1, 0).AddDate(0, 0, -1).Format("2006-01-02")

	rows, err := s.db.QueryContext(ctx, `
		select to_char(t.posted_date, 'YYYY-MM'),
		       sum(t.debit),
		       count(*)
		from transaction t
		join merchant m on t.merchant_id = m.id
		where m.is_bnpl = true and t.debit > 0
		  and t.posted_date >= $1::date and t.posted_date <= $2::date
		group by to_char(t.posted_date, 'YYYY-MM')
		order by to_char(t.posted_date, 'YYYY-MM')`,
		first, last)
	if err != nil {
		return out, fmt.Errorf("read bnpl: %w", err)
	}
	defer rows.Close()

	monthData := []BNPLMonth{}
	for rows.Next() {
		var m BNPLMonth
		m.TransactionIDs = []int64{}
		if err := rows.Scan(&m.Month, &m.BNPLOutflow, &m.PaymentCount); err != nil {
			return out, fmt.Errorf("read bnpl row: %w", err)
		}

		txRows, queryErr := s.db.QueryContext(ctx, `
			select t.id from transaction t
			join merchant m on t.merchant_id = m.id
			where m.is_bnpl = true and t.debit > 0
			  and to_char(t.posted_date, 'YYYY-MM') = $1
			order by t.posted_date`,
			m.Month)
		if queryErr != nil {
			rows.Close()
			return out, fmt.Errorf("read bnpl transaction ids: %w", queryErr)
		}
		for txRows.Next() {
			var id int64
			if err := txRows.Scan(&id); err != nil {
				txRows.Close()
				rows.Close()
				return out, fmt.Errorf("scan bnpl transaction id: %w", err)
			}
			m.TransactionIDs = append(m.TransactionIDs, id)
		}
		txRows.Close()
		monthData = append(monthData, m)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}

	if len(monthData) < 3 {
		out.Status = "insufficient_data"
		out.Summary = "Insufficient BNPL data to detect trends."
		out.Limits = "Requires at least 3 months of BNPL transactions. BNPL identification uses known provider names and manual merchant tagging."
		out.NextStep = "Add BNPL merchants to your profile as you identify them."
		return out, nil
	}

	for i := range monthData {
		if i > 0 {
			monthData[i].PreviousMonth = &monthData[i-1].BNPLOutflow
		}
		if i >= 2 {
			avg := (monthData[i].BNPLOutflow + monthData[i-1].BNPLOutflow + monthData[i-2].BNPLOutflow) / 3
			monthData[i].ThreeMonthAverage = &avg
			if monthData[i].PreviousMonth != nil && monthData[i].BNPLOutflow > *monthData[i].PreviousMonth && monthData[i].BNPLOutflow > avg {
				monthData[i].IsRising = true
			}
		}
	}

	out.Evidence.Months = monthData
	out.Status = "ok"
	latest := out.Evidence.Months[len(out.Evidence.Months)-1]

	if latest.IsRising {
		out.Summary = fmt.Sprintf("BNPL commitments are rising: %s this month vs %s average.", FormatHalalas(latest.BNPLOutflow), FormatHalalas(*latest.ThreeMonthAverage))
	} else {
		out.Summary = fmt.Sprintf("BNPL commitments are stable or falling: %s this month vs %s average.", FormatHalalas(latest.BNPLOutflow), FormatHalalas(*latest.ThreeMonthAverage))
	}

	out.Limits = "BNPL identification uses known provider names (Tabby, Tamara, Postpay, Spotii, Cashew) and manual merchant tagging. Unknown providers will not be detected."
	out.NextStep = "Review upcoming BNPL payment dates and plan repayment."

	return out, nil
}

// FormatHalalas renders integer halalas the way the web tables do: "3,500.00 SAR".
func FormatHalalas(halalas int64) string {
	sign := ""
	magnitude := uint64(halalas)
	if halalas < 0 {
		sign = "-"
		magnitude = uint64(-(halalas + 1)) + 1
	}

	riyals := strconv.FormatUint(magnitude/100, 10)

	var b strings.Builder
	b.WriteString(sign)
	for i, digit := range riyals {
		if i > 0 && (len(riyals)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(digit)
	}
	fmt.Fprintf(&b, ".%02d SAR", magnitude%100)
	return b.String()
}

const (
	SuggestionCardCoverage    = "card_coverage"
	SuggestionRecurring       = "recurring"
	SuggestionBNPL            = "bnpl"
	SuggestionSalaryTrend     = "salary_trend"
	SuggestionTransferMatches = "transfer_matches"

	DecisionAcknowledged = "acknowledged"
	DecisionDismissed    = "dismissed"
)

func ValidSuggestionKind(kind string) bool {
	switch kind {
	case SuggestionCardCoverage, SuggestionRecurring, SuggestionBNPL,
		SuggestionSalaryTrend, SuggestionTransferMatches:
		return true
	}
	return false
}

func ValidSuggestionDecision(decision string) bool {
	return decision == DecisionAcknowledged || decision == DecisionDismissed
}

// SuggestionDecision returns "" when the owner has not decided.
func (s *Store) SuggestionDecision(ctx context.Context, kind string) (string, error) {
	if !ValidSuggestionKind(kind) {
		return "", fmt.Errorf("%w: unknown suggestion kind", ErrBadFilter)
	}
	var decision string
	err := s.db.QueryRowContext(ctx, `
		select payload->>'decision' from user_decision
		where kind = $1
		order by created_at desc
		limit 1`, kind).Scan(&decision)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("read suggestion decision: %w", err)
	}
	return decision, nil
}

func (s *Store) SetSuggestionDecision(ctx context.Context, kind, decision string) error {
	if !ValidSuggestionKind(kind) || !ValidSuggestionDecision(decision) {
		return fmt.Errorf("%w: unknown suggestion decision", ErrBadFilter)
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin suggestion decision: %w", err)
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `delete from user_decision where kind = $1`, kind); err != nil {
		return fmt.Errorf("clear suggestion decision: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
		insert into user_decision (kind, payload)
		values ($1, jsonb_build_object('decision', $2::text))`, kind, decision); err != nil {
		return fmt.Errorf("store suggestion decision: %w", err)
	}
	return tx.Commit()
}

func (s *Store) ClearSuggestionDecision(ctx context.Context, kind string) error {
	if !ValidSuggestionKind(kind) {
		return fmt.Errorf("%w: unknown suggestion kind", ErrBadFilter)
	}
	if _, err := s.db.ExecContext(ctx, `delete from user_decision where kind = $1`, kind); err != nil {
		return fmt.Errorf("clear suggestion decision: %w", err)
	}
	return nil
}

func monthBounds(fromMonth, toMonth string) (string, string, error) {
	from, err := time.Parse("2006-01", fromMonth)
	if err != nil {
		return "", "", fmt.Errorf("%w: from must be YYYY-MM", ErrBadFilter)
	}
	to, err := time.Parse("2006-01", toMonth)
	if err != nil {
		return "", "", fmt.Errorf("%w: to must be YYYY-MM", ErrBadFilter)
	}
	if from.After(to) {
		return "", "", fmt.Errorf("%w: from month is after to month", ErrBadFilter)
	}
	first := from.Format("2006-01-02")
	last := time.Date(to.Year(), to.Month(), 1, 0, 0, 0, 0, time.UTC).
		AddDate(0, 1, 0).AddDate(0, 0, -1).Format("2006-01-02")
	return first, last, nil
}

type SalaryMonth struct {
	Month        string `json:"month"`
	SalaryTotal  int64  `json:"salary_total"`
	DepositCount int64  `json:"deposit_count"`
}

type SalaryTrendResult struct {
	Status string `json:"status"`
	Period struct {
		From string `json:"from"`
		To   string `json:"to"`
	} `json:"period"`
	Summary  string `json:"summary"`
	Evidence struct {
		Months []SalaryMonth `json:"months"`
	} `json:"evidence"`
	Limits   string `json:"limits"`
	NextStep string `json:"next_step"`
	Decision string `json:"decision"`
}

func (s *Store) SalaryTrend(ctx context.Context, fromMonth, toMonth string) (SalaryTrendResult, error) {
	var out SalaryTrendResult
	out.Evidence.Months = []SalaryMonth{}
	out.Period.From = fromMonth
	out.Period.To = toMonth

	decision, err := s.SuggestionDecision(ctx, SuggestionSalaryTrend)
	if err != nil {
		return out, err
	}
	out.Decision = decision

	first, last, err := monthBounds(fromMonth, toMonth)
	if err != nil {
		return out, err
	}

	rows, err := s.db.QueryContext(ctx, `
		select to_char(posted_date, 'YYYY-MM'), sum(credit), count(*)
		from transaction
		where kind = 'salary' and credit > 0
		  and posted_date >= $1::date and posted_date <= $2::date
		group by 1
		order by 1`, first, last)
	if err != nil {
		return out, fmt.Errorf("read salary trend: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var m SalaryMonth
		if err := rows.Scan(&m.Month, &m.SalaryTotal, &m.DepositCount); err != nil {
			return out, fmt.Errorf("read salary row: %w", err)
		}
		out.Evidence.Months = append(out.Evidence.Months, m)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}

	if len(out.Evidence.Months) < 3 {
		out.Status = "insufficient_data"
		out.Summary = "Fewer than 3 months have a salary deposit."
		out.Limits = "Requires at least 3 months with a transaction recorded as salary income."
		out.NextStep = "Import more statements so salary months can be compared."
		return out, nil
	}

	firstMonth := out.Evidence.Months[0]
	lastMonth := out.Evidence.Months[len(out.Evidence.Months)-1]
	var total int64
	for _, m := range out.Evidence.Months {
		total += m.SalaryTotal
	}
	average := total / int64(len(out.Evidence.Months))
	change := int64(0)
	if firstMonth.SalaryTotal > 0 {
		change = int64(math.Round(float64(lastMonth.SalaryTotal-firstMonth.SalaryTotal) /
			float64(firstMonth.SalaryTotal) * 100))
	}

	out.Status = "ok"
	switch {
	case change >= 5:
		out.Summary = fmt.Sprintf("Salary income is rising %d%% from %s to %s across %d months.",
			change, FormatHalalas(firstMonth.SalaryTotal), FormatHalalas(lastMonth.SalaryTotal),
			len(out.Evidence.Months))
	case change <= -5:
		out.Summary = fmt.Sprintf("Salary income is falling %d%% from %s to %s across %d months.",
			-change, FormatHalalas(firstMonth.SalaryTotal), FormatHalalas(lastMonth.SalaryTotal),
			len(out.Evidence.Months))
	default:
		out.Summary = fmt.Sprintf("Salary income is steady around %s a month across %d months (%d%% change).",
			FormatHalalas(average), len(out.Evidence.Months), change)
	}
	out.Limits = "Salary detection relies on the statement row being recorded as salary. Months without a salary row are omitted."
	out.NextStep = "Compare the salary trend with the spending trend before changing a budget."
	return out, nil
}

type TransferMatch struct {
	Amount              int64  `json:"amount"`
	DebitDate           string `json:"debit_date"`
	DebitAccount        string `json:"debit_account"`
	DebitTransactionID  int64  `json:"debit_transaction_id"`
	CreditDate          string `json:"credit_date"`
	CreditAccount       string `json:"credit_account"`
	CreditTransactionID int64  `json:"credit_transaction_id"`
	CountsAsSpending    bool   `json:"counts_as_spending"`
}

type TransferMatchesResult struct {
	Status string `json:"status"`
	Period struct {
		From string `json:"from"`
		To   string `json:"to"`
	} `json:"period"`
	Summary  string `json:"summary"`
	Evidence struct {
		Matches []TransferMatch `json:"matches"`
	} `json:"evidence"`
	Limits   string `json:"limits"`
	NextStep string `json:"next_step"`
	Decision string `json:"decision"`
}

type transferRow struct {
	id        int64
	accountID int64
	date      time.Time
	amount    int64
	spending  bool
	account   string
}

func (s *Store) TransferMatches(ctx context.Context, fromMonth, toMonth string) (TransferMatchesResult, error) {
	var out TransferMatchesResult
	out.Evidence.Matches = []TransferMatch{}
	out.Period.From = fromMonth
	out.Period.To = toMonth

	decision, err := s.SuggestionDecision(ctx, SuggestionTransferMatches)
	if err != nil {
		return out, err
	}
	out.Decision = decision

	first, last, err := monthBounds(fromMonth, toMonth)
	if err != nil {
		return out, err
	}

	rows, err := s.db.QueryContext(ctx, `
		select t.id, t.account_id, t.posted_date, t.debit, t.credit, t.counts_as_spending,
		       a.bank, a.number
		from transaction t
		join account a on a.id = t.account_id
		where t.transfer_pair_id is null
		  and t.posted_date >= $1::date and t.posted_date <= $2::date
		  and (t.debit > 0 or t.credit > 0)
		order by t.posted_date, t.id`, first, last)
	if err != nil {
		return out, fmt.Errorf("read transfer candidates: %w", err)
	}
	defer rows.Close()

	var debits, credits []transferRow
	for rows.Next() {
		var r transferRow
		var debit, credit int64
		var spending bool
		var bank string
		var number sql.NullString
		if err := rows.Scan(&r.id, &r.accountID, &r.date, &debit, &credit, &spending,
			&bank, &number); err != nil {
			return out, fmt.Errorf("read transfer candidate: %w", err)
		}
		r.spending = spending
		r.account = maskAccount(bank, number)
		if debit > 0 {
			r.amount = debit
			debits = append(debits, r)
		} else {
			r.amount = credit
			credits = append(credits, r)
		}
	}
	if err := rows.Err(); err != nil {
		return out, err
	}

	used := map[int64]bool{}
	for _, d := range debits {
		best := -1
		var bestGap int64
		for i, c := range credits {
			if used[c.id] || c.accountID == d.accountID || c.amount != d.amount {
				continue
			}
			gap := int64(math.Abs(c.date.Sub(d.date).Hours() / 24))
			if gap > 3 {
				continue
			}
			if best == -1 || gap < bestGap {
				best = i
				bestGap = gap
			}
		}
		if best == -1 {
			continue
		}
		c := credits[best]
		used[c.id] = true
		out.Evidence.Matches = append(out.Evidence.Matches, TransferMatch{
			Amount:              d.amount,
			DebitDate:           d.date.Format("2006-01-02"),
			DebitAccount:        d.account,
			DebitTransactionID:  d.id,
			CreditDate:          c.date.Format("2006-01-02"),
			CreditAccount:       c.account,
			CreditTransactionID: c.id,
			CountsAsSpending:    d.spending,
		})
	}

	if len(out.Evidence.Matches) == 0 {
		out.Status = "insufficient_data"
		out.Summary = "No likely internal transfers found in this period."
		out.Limits = "Pairs need one debit and one credit of the same amount in different accounts within 3 days, neither already matched."
		out.NextStep = "Import statements for the other accounts so transfers between them can be paired."
		return out, nil
	}

	var inflated int64
	var inflatedCount int
	for _, m := range out.Evidence.Matches {
		if m.CountsAsSpending {
			inflated += m.Amount
			inflatedCount++
		}
	}
	out.Status = "ok"
	if inflatedCount > 0 {
		out.Summary = fmt.Sprintf("%d likely internal transfers found. %d of them count as spending and inflate the spending figure by %s.",
			len(out.Evidence.Matches), inflatedCount, FormatHalalas(inflated))
	} else {
		out.Summary = fmt.Sprintf("%d likely internal transfers found. They are not counted as spending, so the spending figure is not inflated.",
			len(out.Evidence.Matches))
	}
	out.Limits = "Matching uses amount, account and a 3 day window. It cannot tell a transfer from two unrelated payments of the same amount."
	out.NextStep = "Review each pair and mark it as an internal transfer so it leaves the spending figure."
	return out, nil
}

func maskAccount(bank string, number sql.NullString) string {
	if !number.Valid || number.String == "" {
		return bank
	}
	return bank + " " + MaskNumber(number.String)
}
