package statement

import "testing"

func TestParseAmount(t *testing.T) {
	cases := []struct {
		in   string
		want int64
		ok   bool
	}{
		{"0.00", 0, true},
		{"25.75", 2575, true},
		{"1,234.56", 123456, true},
		{"-1,000.00", -100000, true},
		{" 12.5 ", 1250, true},
		{"12", 1200, true},
		{".5", 50, true},
		{"", 0, false},
		{"12.345", 0, false},
		{"12.3.4", 0, false},
		{"SAR 12.00", 0, false},
	}
	for _, c := range cases {
		got, ok := ParseAmount(c.in)
		if ok != c.ok || (ok && got != c.want) {
			t.Errorf("ParseAmount(%q) = %d, %v; want %d, %v", c.in, got, ok, c.want, c.ok)
		}
	}
}

func TestFormatAmount(t *testing.T) {
	cases := map[int64]string{
		0:       "0.00",
		5:       "0.05",
		2575:    "25.75",
		-100000: "-1000.00",
		123456:  "1234.56",
	}
	for in, want := range cases {
		if got := FormatAmount(in); got != want {
			t.Errorf("FormatAmount(%d) = %q; want %q", in, got, want)
		}
	}
}
