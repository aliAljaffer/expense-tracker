package importer

import (
	"regexp"
	"strings"
)

// NormalizeMerchant converts a raw merchant string to a canonical name.
// Rules applied in order:
// - Uppercase the string
// - Trim leading and trailing whitespace
// - Collapse multiple spaces to single space
// - Remove trailing branch/store numbers (patterns like #123, -123, or abbreviations after spaces)
// - Keep Arabic text as is
//
// The goal is to merge variations of the same merchant (e.g., "SAMPLE STORE" and
// "SAMPLE STORE #TRAD") while keeping distinct merchants separate. Returns the
// original input if empty.
func NormalizeMerchant(raw string) string {
	if raw == "" {
		return ""
	}

	result := strings.ToUpper(raw)
	result = strings.TrimSpace(result)
	result = collapseSpaces(result)
	result = stripTrailingTokens(result)
	return result
}

// collapseSpaces reduces runs of spaces to a single space.
func collapseSpaces(s string) string {
	return regexp.MustCompile(`\s+`).ReplaceAllString(s, " ")
}

// stripTrailingTokens removes patterns at the end that look like store/branch numbers.
// It removes:
// - Hash-prefixed tokens: " #TRAD", " #123", " # ABC"
// - Hyphen-prefixed tokens: " -123", " -001"
// - Purely numeric tokens at the end: " 123", " 001" (but only 1-4 digits)
//
// Conservative: when unsure, keeps the token. Arabic text is never stripped.
func stripTrailingTokens(s string) string {
	s = regexp.MustCompile(`\s+#.*$`).ReplaceAllString(s, "")
	s = regexp.MustCompile(`\s+-\d+$`).ReplaceAllString(s, "")
	s = regexp.MustCompile(`\s+\d{1,4}$`).ReplaceAllString(s, "")
	return s
}

// IsBNPLMerchant reports whether a canonical merchant name is a known BNPL provider.
// It performs a whole-word match on the provider names.
var knownBNPLProviders = map[string]bool{
	"TABBY":    true,
	"TAMARA":   true,
	"POSTPAY":  true,
	"SPOTII":   true,
	"CASHEW":   true,
	"BUYFIRST": true,
}

func IsBNPLMerchant(canonicalName string) bool {
	upper := strings.ToUpper(strings.TrimSpace(canonicalName))
	for provider := range knownBNPLProviders {
		if isWholeWordMatch(upper, provider) {
			return true
		}
	}
	return false
}

// isWholeWordMatch checks if the word appears as a whole word in the text.
func isWholeWordMatch(text, word string) bool {
	re := regexp.MustCompile(`\b` + regexp.QuoteMeta(word) + `\b`)
	return re.MatchString(text)
}
