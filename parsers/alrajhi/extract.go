package alrajhi

import (
	"bytes"
	"math"
	"sort"
	"strings"

	"github.com/ledongthuc/pdf"
)

// extractLines turns a PDF into visual text lines, approximating the output of
// `pdftotext -layout`. Without the layout the amount columns interleave and no
// row can be read.
func extractLines(data []byte) ([]string, error) {
	r, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, err
	}
	var lines []string
	for p := 1; p <= r.NumPage(); p++ {
		page := r.Page(p)
		if page.V.IsNull() {
			continue
		}
		lines = append(lines, pageLines(page.Content().Text)...)
	}
	return lines, nil
}

// pageLines groups glyphs by baseline. Rows a few points apart are separate
// lines; glyphs of one line differ only by rounding.
func pageLines(glyphs []pdf.Text) []string {
	sort.SliceStable(glyphs, func(i, j int) bool { return glyphs[i].Y > glyphs[j].Y })
	var lines []string
	for start := 0; start < len(glyphs); {
		end := start
		for end < len(glyphs) && math.Abs(glyphs[end].Y-glyphs[start].Y) <= 2 {
			end++
		}
		lines = append(lines, joinGlyphs(glyphs[start:end]))
		start = end
	}
	return lines
}

// joinGlyphs rebuilds the spacing of one line from glyph positions, so column
// boundaries survive as runs of spaces.
func joinGlyphs(group []pdf.Text) string {
	sort.SliceStable(group, func(i, j int) bool { return group[i].X < group[j].X })
	var b strings.Builder
	prevEnd := math.Inf(-1)
	for _, g := range group {
		size := g.FontSize
		if size <= 0 {
			size = 10
		}
		if gap := g.X - prevEnd; !math.IsInf(prevEnd, -1) && gap > 1 {
			spaces := int(math.Round(gap / (size * 0.5)))
			if spaces < 1 {
				spaces = 1
			}
			if spaces > 40 {
				spaces = 40
			}
			b.WriteString(strings.Repeat(" ", spaces))
		}
		b.WriteString(g.S)
		prevEnd = g.X + g.W
	}
	return strings.TrimRight(b.String(), " ")
}
