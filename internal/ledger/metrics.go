package ledger

import "context"

// Metrics are the business counts the Prometheus endpoint exposes. Amounts are
// SAR, converted from the stored halalas at read time.
type Metrics struct {
	Transactions             int64
	TransactionsCurrentMonth int64
	SpendingSARMonth         float64
	UncategorisedSARMonth    float64
	Imports                  int64
	LastImportUnix           float64
}

// Metrics reads the business gauges in a single round trip. Uncategorised spend
// mirrors the "uncategorised" bucket in Monthly.
func (s *Store) Metrics(ctx context.Context) (Metrics, error) {
	var m Metrics
	var spending, uncategorised int64
	err := s.db.QueryRow(ctx, `
		select
			(select count(*) from transaction),
			(select count(*) from transaction
			  where posted_date >= date_trunc('month', current_date)::date),
			(select coalesce(sum(debit), 0) from transaction
			  where counts_as_spending and debit > 0
			    and posted_date >= date_trunc('month', current_date)::date),
			(select coalesce(sum(debit), 0) from transaction
			  where counts_as_spending and debit > 0 and category_id is null
			    and posted_date >= date_trunc('month', current_date)::date),
			(select count(*) from statement_import),
			(select coalesce(extract(epoch from max(created_at)), 0)::double precision from statement_import
			  where status = 'accepted')
	`).Scan(&m.Transactions, &m.TransactionsCurrentMonth, &spending, &uncategorised, &m.Imports, &m.LastImportUnix)
	if err != nil {
		return Metrics{}, err
	}
	m.SpendingSARMonth = float64(spending) / 100
	m.UncategorisedSARMonth = float64(uncategorised) / 100
	return m, nil
}
