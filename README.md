# Expense Tracker

Self-hosted, private analysis of Saudi bank statements. Imports Alinma XLSX and
Al Rajhi PDF exports, refuses any statement that does not reconcile against its
own header, blocks duplicate imports, and explains spending in plain language.

Go for parsing, storage, and suggestions. Next.js for the interface.
PostgreSQL for storage. No statement data leaves the deployment.

## Status

Early. The two statement parsers work as Python reference implementations in
`parsers/reference/`. The Go port, API, and web app are next.

## Layout

| Path | Contents |
|---|---|
| `parsers/` | Statement parsers. Go packages, with the Python originals kept as a reference during the port |
| `docs/` | Design and operating notes |
| `PLAN.md` | Phased implementation plan |

## Documents

| File | Contents |
|---|---|
| `docs/FEATURES.md` | Prioritized feature list with rationale |
| `docs/PARSING-NOTES.md` | Format gotchas per bank |
| `docs/DATA-MODEL.md` | Schema |

All examples in these documents are synthetic. Real statements stay out of Git.

## Scope

Statement import first. The user exports a file from the bank app and uploads
it. No credentials are stored and no aggregator contract is needed.

An open banking feed through a SAMA-licensed aggregator can be added later
behind the same normalization layer.
