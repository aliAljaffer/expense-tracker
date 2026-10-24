package importer

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

var ErrInvalidDateFormat = errors.New("invalid date format")

// ParseStatementDate parses a statement period date in one of three formats:
// DD/MM/YYYY (Alinma), YYYY/MM/DD (Al Rajhi), or YYYY-MM-DD (ISO).
// It returns an error for impossible dates (e.g., 31/02/2026) or ambiguous formats.
func ParseStatementDate(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, nil
	}

	var parts []string
	var sep rune

	// Parse with consistent separator: / or -
	if strings.Contains(s, "/") {
		sep = '/'
		parts = strings.Split(s, "/")
	} else if strings.Contains(s, "-") {
		sep = '-'
		parts = strings.Split(s, "-")
	} else {
		return time.Time{}, fmt.Errorf("%w: %q", ErrInvalidDateFormat, s)
	}

	// Reject mixed separators
	if (sep == '/' && strings.Contains(s, "-")) || (sep == '-' && strings.Contains(s, "/")) {
		return time.Time{}, fmt.Errorf("%w: %q", ErrInvalidDateFormat, s)
	}

	if len(parts) != 3 {
		return time.Time{}, fmt.Errorf("%w: %q", ErrInvalidDateFormat, s)
	}

	// Determine the format based on the length and content of parts
	var year, month, day int
	var err error

	if len(parts[0]) == 4 && parts[0] > "1900" {
		// YYYY/MM/DD or YYYY-MM-DD format
		year, err = strconv.Atoi(parts[0])
		if err != nil {
			return time.Time{}, fmt.Errorf("%w: %q", ErrInvalidDateFormat, s)
		}
		month, err = strconv.Atoi(parts[1])
		if err != nil {
			return time.Time{}, fmt.Errorf("%w: %q", ErrInvalidDateFormat, s)
		}
		day, err = strconv.Atoi(parts[2])
		if err != nil {
			return time.Time{}, fmt.Errorf("%w: %q", ErrInvalidDateFormat, s)
		}
	} else if len(parts[2]) == 4 {
		// DD/MM/YYYY format (must use /, not -)
		if sep != '/' {
			return time.Time{}, fmt.Errorf("%w: %q", ErrInvalidDateFormat, s)
		}
		day, err = strconv.Atoi(parts[0])
		if err != nil {
			return time.Time{}, fmt.Errorf("%w: %q", ErrInvalidDateFormat, s)
		}
		month, err = strconv.Atoi(parts[1])
		if err != nil {
			return time.Time{}, fmt.Errorf("%w: %q", ErrInvalidDateFormat, s)
		}
		year, err = strconv.Atoi(parts[2])
		if err != nil {
			return time.Time{}, fmt.Errorf("%w: %q", ErrInvalidDateFormat, s)
		}
	} else {
		return time.Time{}, fmt.Errorf("%w: %q", ErrInvalidDateFormat, s)
	}

	// Validate the date
	t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)

	// Check if the date is valid by ensuring the parsed date matches what we set
	if t.Year() != year || t.Month() != time.Month(month) || t.Day() != day {
		return time.Time{}, fmt.Errorf("%w: %q (invalid date)", ErrInvalidDateFormat, s)
	}

	return t, nil
}
