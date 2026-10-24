package importer

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"strconv"
	"time"

	"github.com/aliAljaffer/expense-tracker/parsers/statement"
)

// Parsers do not expose a posting time, so every row hashes at midnight. The
// database column defaults to the same value.
const postedTime = "00:00:00"

var fingerprintEpoch = time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)

// Fingerprint repeats the expression of the transaction.fingerprint generated
// column. A test asserts both produce the same value; change them together.
func Fingerprint(accountID int64, t statement.Transaction) (string, error) {
	day, err := time.Parse(time.DateOnly, t.PostedDate)
	if err != nil {
		return "", fmt.Errorf("posted date %q: %w", t.PostedDate, err)
	}
	balance := ""
	if t.BalanceAfter != nil {
		balance = strconv.FormatInt(*t.BalanceAfter, 10)
	}
	raw := fmt.Sprintf("%d|%d|%s|%s|%d|%d|%s|%s",
		accountID,
		int(day.Sub(fingerprintEpoch).Hours()/24),
		postedTime,
		t.Kind,
		t.Debit,
		t.Credit,
		balance,
		t.DescriptionRaw,
	)
	sum := md5.Sum([]byte(raw))
	return hex.EncodeToString(sum[:]), nil
}
