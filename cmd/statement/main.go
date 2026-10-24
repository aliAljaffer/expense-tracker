// Command statement parses one bank export and reports reconciliation.
//
// Usage:
//
//	statement <file.xlsx|file.pdf> [--json out.json]
//
// Exit code 0 means the statement reconciled, 1 means it did not, 2 means the
// file could not be read or parsed.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/aliAljaffer/expense-tracker/parsers/alinma"
	"github.com/aliAljaffer/expense-tracker/parsers/alrajhi"
	"github.com/aliAljaffer/expense-tracker/parsers/statement"
)

func main() {
	path, jsonOut := "", ""
	for _, arg := range os.Args[1:] {
		switch {
		case strings.HasPrefix(arg, "--json="):
			jsonOut = strings.TrimPrefix(arg, "--json=")
		case path == "":
			path = arg
		default:
			fail(fmt.Errorf("unexpected argument %q", arg))
		}
	}
	if path == "" {
		fmt.Fprintln(os.Stderr, "usage: statement <file.xlsx|file.pdf> [--json=out.json]")
		os.Exit(2)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		fail(err)
	}

	var s *statement.Statement
	switch strings.ToLower(filepath.Ext(path)) {
	case ".xlsx":
		s, err = alinma.Parse(data)
	case ".pdf":
		s, err = alrajhi.Parse(data)
	default:
		err = fmt.Errorf("unsupported file type %q", filepath.Ext(path))
	}
	if err != nil {
		fail(err)
	}

	recon := s.Reconcile()
	report(path, s, recon)
	if jsonOut != "" {
		out, err := os.Create(jsonOut)
		if err != nil {
			fail(err)
		}
		enc := json.NewEncoder(out)
		enc.SetIndent("", "  ")
		enc.SetEscapeHTML(false)
		err = enc.Encode(struct {
			*statement.Statement
			Reconciliation statement.Reconciliation `json:"reconciliation"`
		}{s, recon})
		out.Close()
		if err != nil {
			fail(err)
		}
		fmt.Printf("wrote         %s\n", jsonOut)
	}
	if !recon.OK {
		os.Exit(1)
	}
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(2)
}

func report(path string, s *statement.Statement, r statement.Reconciliation) {
	amount := func(v *int64) string {
		if v == nil {
			return "unknown"
		}
		return statement.FormatAmount(*v)
	}
	fmt.Printf("source        %s\n", path)
	fmt.Printf("parser        %s v%s\n", s.Parser, s.ParserVersion)
	fmt.Printf("bank          %s\n", s.Bank)
	fmt.Printf("account       %s\n", s.AccountNumber)
	fmt.Printf("period        %s .. %s\n", s.PeriodStart, s.PeriodEnd)
	fmt.Printf("balance       %s -> %s\n", amount(s.OpeningBalance), amount(s.ClosingBalance))
	fmt.Printf("transactions  %d\n", len(s.Transactions))
	fmt.Println("reconciliation")
	for _, c := range r.Checks {
		detail := ""
		if c.Status != statement.Skip {
			detail = fmt.Sprintf("  parsed=%s stated=%s", c.Parsed, c.Stated)
		}
		fmt.Printf("  %-5s %s%s\n", c.Status, c.Name, detail)
	}
	result := "ok"
	if !r.OK {
		result = "REJECT"
	}
	fmt.Printf("RESULT        %s\n", result)
}
