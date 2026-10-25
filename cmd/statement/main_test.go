package main

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/aliAljaffer/grooszy/parsers/alrajhi"
)

// manyPagePDF builds a valid PDF with n empty pages.
func manyPagePDF(n int) []byte {
	var buf bytes.Buffer
	buf.WriteString("%PDF-1.4\n")
	total := 3 + 2*n
	offsets := make([]int, total+1)
	add := func(num int, body string) {
		offsets[num] = buf.Len()
		fmt.Fprintf(&buf, "%d 0 obj\n%s\nendobj\n", num, body)
	}
	add(1, "<</Type/Catalog/Pages 2 0 R>>")
	kids := make([]string, n)
	for i := range kids {
		kids[i] = fmt.Sprintf("%d 0 R", 4+2*i)
	}
	add(2, fmt.Sprintf("<</Type/Pages/Kids[%s]/Count %d>>", strings.Join(kids, " "), n))
	add(3, "<</Type/Font/Subtype/Type1/BaseFont/Courier>>")
	for i := 0; i < n; i++ {
		page := 4 + 2*i
		add(page, fmt.Sprintf("<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 3 0 R>>>>/Contents %d 0 R>>", page+1))
		offsets[page+1] = buf.Len()
		fmt.Fprintf(&buf, "%d 0 obj\n<</Length 0>>\nstream\n\nendstream\nendobj\n", page+1)
	}
	xref := buf.Len()
	fmt.Fprintf(&buf, "xref\n0 %d\n0000000000 65535 f \n", total+1)
	for i := 1; i <= total; i++ {
		fmt.Fprintf(&buf, "%010d 00000 n \n", offsets[i])
	}
	fmt.Fprintf(&buf, "trailer\n<</Size %d/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF\n", total+1, xref)
	return buf.Bytes()
}

func TestPDFOverPageLimitExitsTwo(t *testing.T) {
	if path := os.Getenv("STATEMENT_MAIN_FILE"); path != "" {
		os.Args = []string{"statement", path}
		main()
		return
	}

	path := filepath.Join(t.TempDir(), "long.pdf")
	if err := os.WriteFile(path, manyPagePDF(alrajhi.MaxPages+1), 0o600); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command(os.Args[0], "-test.run=^TestPDFOverPageLimitExitsTwo$")
	cmd.Env = append(os.Environ(), "STATEMENT_MAIN_FILE="+path)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	err := cmd.Run()

	var exit *exec.ExitError
	if !errors.As(err, &exit) || exit.ExitCode() != 2 {
		t.Fatalf("exit = %v, stderr = %s", err, stderr.String())
	}
	if want := fmt.Sprintf("limit is %d", alrajhi.MaxPages); !strings.Contains(stderr.String(), want) {
		t.Fatalf("stderr = %q, want it to contain %q", stderr.String(), want)
	}
}
