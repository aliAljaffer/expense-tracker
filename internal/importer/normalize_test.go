package importer

import (
	"testing"
)

func TestNormalizeMerchant(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		// Basic normalization: uppercase and trim
		{"sample store", "SAMPLE STORE"},
		{"  SAMPLE STORE  ", "SAMPLE STORE"},
		{"SaMpLe StOrE", "SAMPLE STORE"},

		// Collapse spaces
		{"SAMPLE    STORE", "SAMPLE STORE"},
		{"SAMPLE  STORE  TRADING", "SAMPLE STORE TRADING"},

		// Strip trailing hash-prefixed tokens
		{"SAMPLE STORE #TRAD", "SAMPLE STORE"},
		{"SAMPLE STORE #123", "SAMPLE STORE"},
		{"SAMPLE STORE # ABC", "SAMPLE STORE"},

		// Strip trailing hyphen-prefixed numbers
		{"SAMPLE STORE -123", "SAMPLE STORE"},
		{"SAMPLE STORE -001", "SAMPLE STORE"},

		// Strip trailing numeric tokens (1-4 digits)
		{"SAMPLE STORE 123", "SAMPLE STORE"},
		{"SAMPLE STORE 1", "SAMPLE STORE"},
		{"SAMPLE STORE 001", "SAMPLE STORE"},

		// Keep 5+ digit numbers at the end (they look like important IDs, not branch numbers)
		{"SAMPLE STORE 12345", "SAMPLE STORE 12345"},
		{"SAMPLE STORE 123456", "SAMPLE STORE 123456"},

		// Word-based names are kept (conservative: only strip numeric/hash-based tokens)
		{"SAMPLE STORE TRAD", "SAMPLE STORE TRAD"},
		{"SAMPLE STORE TRADING", "SAMPLE STORE TRADING"},

		// Two near names that should NOT merge without explicit hash-based separator
		{"SAMPLE STORE", "SAMPLE STORE"},
		{"SAMPLE SHOP", "SAMPLE SHOP"},

		// Empty string
		{"", ""},

		// Whitespace only
		{"   ", ""},

		// Complex cases
		{"SAMPLE STORE #TRAD 123", "SAMPLE STORE"},
		{"SAMPLE STORE -001 #456", "SAMPLE STORE"},

		// Arabic text should be preserved (not stripped)
		{"SAMPLE STORE مدينة", "SAMPLE STORE مدينة"},
		{"مدينة 123", "مدينة"},
	}

	for _, tt := range tests {
		got := NormalizeMerchant(tt.input)
		if got != tt.expected {
			t.Errorf("NormalizeMerchant(%q) = %q; want %q", tt.input, got, tt.expected)
		}
	}
}

func TestIsBNPLMerchant(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{"TABBY", true},
		{"TAMARA", true},
		{"POSTPAY", true},
		{"SPOTII", true},
		{"CASHEW", true},
		{"BUYFIRST", true},

		// Whole-word match only
		{"TABBY STORE", true},
		{"STORE TABBY", true},
		{"TABBY SHOP AND CAFE", true},

		// Case-insensitive
		{"tabby", true},
		{"Tabby", true},
		{"TaBbY", true},

		// Partial matches should NOT match
		{"TABBYTHON", false},
		{"MYTABBY", false},
		{"TABUFFY", false},

		// Non-BNPL merchants
		{"SAMPLE STORE", false},
		{"AMAZON", false},
		{"STARBUCKS", false},

		// Empty
		{"", false},
	}

	for _, tt := range tests {
		got := IsBNPLMerchant(tt.input)
		if got != tt.expected {
			t.Errorf("IsBNPLMerchant(%q) = %v; want %v", tt.input, got, tt.expected)
		}
	}
}
