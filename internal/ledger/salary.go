package ledger

import (
	"context"
	"strings"
)

// SalaryPayersKey holds the employer names that mark a credit as salary, comma
// separated. Bank exports do not label a transfer from an employer as salary,
// so the owner supplies the names.
const SalaryPayersKey = "salary_payers"

// SalaryPayers returns the configured employer names, lowercased and trimmed.
func (s *Store) SalaryPayers(ctx context.Context) ([]string, error) {
	raw, err := s.Setting(ctx, SalaryPayersKey)
	if err != nil {
		return nil, err
	}
	return SplitSalaryPayers(raw), nil
}

// SplitSalaryPayers turns the stored comma-separated list into lowercased names.
func SplitSalaryPayers(raw string) []string {
	out := []string{}
	for _, part := range strings.Split(raw, ",") {
		part = strings.ToLower(strings.TrimSpace(part))
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

// salaryCreditSQL is true for a salary credit. arg names the query argument
// holding the payer names.
func salaryCreditSQL(arg string) string {
	return `(kind = 'salary' or (credit > 0 and kind <> 'refund' and ` +
		salaryPayerSQL(arg) + `))`
}

func salaryPayerSQL(arg string) string {
	return `exists (
		select 1 from unnest($` + arg + `::text[]) p
		where position(p in lower(coalesce(nullif(merchant_raw, ''), description_raw))) > 0)`
}
