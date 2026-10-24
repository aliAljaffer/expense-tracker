# Expense Tracker

Private, self-hosted analysis of Saudi bank statements. Imports Alinma XLSX and
Al Rajhi PDF exports, refuses any statement that does not reconcile against its
own header, blocks duplicate imports, and explains spending in plain language.

Go for parsing, storage, and suggestions. Next.js for the interface.
PostgreSQL for storage.

## Privacy

- Real statements live in `statements/`, which is ignored. Never add it.
- Every example in `docs/` is synthetic. Keep it that way.
- Never print an account number, IBAN, or balance into a tracked file.

## Style

Follow `~/agents/CLAUDE.md`: no em-dashes, no co-author lines, no comments that
restate the code, one-line commit messages.

## Design

Read `.claude/AGENTS.md` before any interface work. It is a submodule holding
two kits. Where they disagree, UI/UX Pro Max wins; the resolved disagreements
are in `.claude/README.md`.

The app palette is `web/design/tokens.json`. Every colour in a component comes
from a semantic token. `web/design/theme.css` is generated, never edited by hand.

```
node .claude/scripts/build_tokens.mjs --in web/design/tokens.json --out web/design/theme.css --check
python3 .claude/scripts/validate_contrast.py web/design/tokens.json
python3 .claude/scripts/validate_tokens.py web/design/tokens.json
```

## Parsers

One Go package per bank. The CLI parses a local export and reports
reconciliation:

```
go run ./cmd/statement statements/<file>.xlsx
go run ./cmd/statement "statements/<file>.pdf" --json=out.json
```

Exit code 0 means the statement reconciled. Exit code 1 means reject the import.
Exit code 2 means the file could not be read or parsed.

## Before committing

Enable the hook once per clone. It refuses a commit that contains statement
data, a real Saudi IBAN, or a staged file under `statements/`:

```
git config core.hooksPath scripts/hooks
```

The check reads the statements in `statements/` for the owner name, account
number, IBAN, and reference numbers. Any new synthetic IBAN used in a test must
be added to `SYNTHETIC_IBANS` in `scripts/check-leaks.py`.
