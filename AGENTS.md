# grooszy

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

The app palette is `web/design/tokens.json`. Every colour in a component comes
from a semantic token. `web/design/theme.css` is generated from the tokens and
is never edited by hand. The design kit that generates and checks it is not
vendored, so run those checks locally before changing a colour.

## Parsers

One Go package per bank. The CLI parses a local export and reports
reconciliation:

```
go run ./cmd/statement statements/<file>.xlsx
go run ./cmd/statement "statements/<file>.pdf" --json=out.json
```

Exit code 0 means the statement reconciled. Exit code 1 means reject the import.
Exit code 2 means the file could not be read or parsed.

## API

`cmd/api` serves the owner-only import API. It needs PostgreSQL and a Keycloak
issuer; `docs/API.md` lists the environment and endpoints.

```
docker run -d --name expense-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 5432:5432 postgres:17
export DATABASE_URL='postgres://postgres:test@localhost:5432/test?sslmode=disable'
bash scripts/check-migrations.sh
DATABASE_URL="$DATABASE_URL" go test -race ./...
```

Database tests build and drop their own schema. Without `DATABASE_URL` they skip.

## Rules for every agent

These rules are enforced, not requested. A commit that breaks them is rejected.

- Write one-line commit messages of at most two sentences.
- Add no Co-Authored-By line and no tool attribution to a commit message.
- Write no em-dashes in code, comments, docs, or commit messages.
- Commit with explicit paths. Never commit `deploy/`, `test-results/`, or a local `.claude/` checkout.
- Follow the UI stack in the plan: plain CSS on the design tokens plus Headless UI. Add no UI library.
- Report only results you saw. If you could not run a check, say so.

The `commit-msg` hook runs `scripts/check-commit-message.sh`. Enable the hook once per clone with `git config core.hooksPath scripts/hooks`.

## Before committing

Enable the hook once per clone. It refuses a commit that contains statement
data, a real Saudi IBAN, or a staged file under `statements/`:

```
git config core.hooksPath scripts/hooks
```

The check reads the statements in `statements/` for the owner name, account
number, IBAN, and reference numbers. A synthetic IBAN in a test must repeat one
digit or end in `1234567890123`; the script stores no IBAN value and never
prints one it matched.
