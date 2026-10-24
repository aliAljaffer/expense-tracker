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
| `web/design/` | App colour tokens, generated theme, and design decisions |
| `.claude/` | Submodule: [ui-ux-conventions](https://github.com/aliAljaffer/ui-ux-conventions), the shared design doctrine and gates |

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

## Design

The interface follows `.claude/`, a submodule holding two design kits and the
rules for choosing between them. The doctrine loads from `.claude/AGENTS.md`.
Where the kits disagree, UI/UX Pro Max wins; `web/design/DESIGN.md` lists the
resolved disagreements.

The app palette is `web/design/tokens.json`. One vibrant accent, lime, on warm
neutrals in light mode and green-tinted near-black in dark mode. Charts use the
data-viz ramp from the same file, never the action colours.

Rebuild the CSS variables after a palette change:

```
node .claude/scripts/build_tokens.mjs --in web/design/tokens.json --out web/design/theme.css --check
```

Check contrast in both modes:

```
python3 .claude/scripts/validate_contrast.py web/design/tokens.json
```

Both currently pass. Every pairing used by a component needs its own check when
the component is built.
