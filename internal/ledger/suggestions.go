package ledger

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	minRecurringCount      = 3
	minRecurringMonths     = 3
	amountTolerancePercent = 20
	maxGapDays             = 45
)

var knownBNPLProviders = map[string]bool{
	"TABBY":    true,
	"TAMARA":   true,
	"POSTPAY":  true,
	"SPOTII":   true,
	"CASHEW":   true,
	"BUYFIRST": true,
}

func isBNPLMerchant(name string) bool {
	upper := strings.ToUpper(strings.TrimSpace(name))
	for provider := range knownBNPLProviders {
		re := regexp.MustCompile(`\b` + regexp.QuoteMeta(provider) + `\b`)
		if re.MatchString(upper) {
			return true
		}
	}
	return false
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
}

func (s *Store) CardCoverage(ctx context.Context, fromMonth, toMonth string) (CardCoverageResult, error) {
	var out CardCoverageResult
	out.Period.From = fromMonth
	out.Period.To = toMonth

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
			if month.TransactionIDs == nil {
				month.TransactionIDs = []int64{}
			}
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
}

func (s *Store) Recurring(ctx context.Context, fromMonth, toMonth string) (RecurringResult, error) {
	var out RecurringResult
	out.Period.From = fromMonth
	out.Period.To = toMonth

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
		if series.TransactionIDs == nil {
			series.TransactionIDs = []int64{}
		}
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
		out.Summary = fmt.Sprintf("One recurring payment found: %s (SAR %.2f/month).", largest.Merchant, float64(largest.MedianAmount)/100)
	} else {
		out.Summary = fmt.Sprintf("%d recurring payments found. The largest is %s (SAR %.2f/month).", count, largest.Merchant, float64(largest.MedianAmount)/100)
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
}

func (s *Store) BNPL(ctx context.Context, fromMonth, toMonth string) (BNPLResult, error) {
	var out BNPLResult
	out.Period.From = fromMonth
	out.Period.To = toMonth

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

	var monthData []BNPLMonth
	for rows.Next() {
		var m BNPLMonth
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
		if m.TransactionIDs == nil {
			m.TransactionIDs = []int64{}
		}
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
		out.Summary = fmt.Sprintf("BNPL commitments are rising: SAR %.2f this month vs SAR %.2f average.", float64(latest.BNPLOutflow)/100, float64(*latest.ThreeMonthAverage)/100)
	} else {
		out.Summary = fmt.Sprintf("BNPL commitments are stable or falling: SAR %.2f this month vs SAR %.2f average.", float64(latest.BNPLOutflow)/100, float64(*latest.ThreeMonthAverage)/100)
	}

	out.Limits = "BNPL identification uses known provider names (Tabby, Tamara, Postpay, Spotii, Cashew) and manual merchant tagging. Unknown providers will not be detected."
	out.NextStep = "Review upcoming BNPL payment dates and plan repayment."

	return out, nil
}
