# Interface design

Two vendored kits govern the interface. This page records which one wins and
why the palette is what it is.

| Source | Location | Role |
|---|---|---|
| UI/UX Pro Max (nextlevelbuilder) | `.claude/skills/ui-ux-pro-max/` | Searchable design database and numbered rules |
| UX/UI agent kit (plugin87) | `AGENTS.md`, `tokens/`, `taste/`, `accessibility/`, `scripts/` | Doctrine, DTCG tokens, objective gates |

Precedence: where the two disagree on a specific rule, UI/UX Pro Max wins.

## Resolved disagreements

| Topic | Agent kit | UI/UX Pro Max | Taken |
|---|---|---|---|
| Minimum target size | 24x24 (WCAG 2.5.8 floor) | 44x44 | 44x44 |
| Transition duration | 100 to 300ms scale | 150 to 300ms | 150 to 300ms, `base` 200ms |
| Accent count | One accent, neutrals carry the weight | Primary, secondary, accent roles | One accent for actions. Extra hues are allowed only in data-viz and feedback |
| Focus indicator | 3:1 against adjacent colours | 2px perimeter at 3:1 | 2px ring, token `interactive.focus-ring` |
| Native select | Never | Not addressed | Never, per the stricter rule |

Both kits agree on: no emoji as icons, no raw hex in components, semantic colour
tokens, 4.5:1 body text, visible keyboard focus, reduced-motion support, and
mobile-first layout.

## Palette

`tokens.json` is the source of truth. `theme.css` is generated from it and is
never edited by hand.

The product is a private tool for one person, not a marketing site. The mood is
precise and alive: numbers are the content, so the surface stays quiet and one
vibrant accent carries attention.

| Role | Light | Dark |
|---|---|---|
| Accent (primary action) | `#a3e635` lime with ink text | `#bef264` lime with near-black text |
| Page | `#fbfaf7` warm white | `#0b0f0c` green-black |
| Body text | `#14140f` | `#f2f5ec` |
| Destructive | `#c81e4a` | `#e11d48` |
| Data viz | 8 hues, all above 4.5:1 on both pages | same hue order, lighter tints |

UI/UX Pro Max recommends a trust-blue and profit-green palette for a personal
finance tracker. That palette is not vibrant, and vibrancy was an explicit
requirement, so it was not adopted. Its surrounding rules were adopted instead.

Charts never use action colours. Series must also differ by shape or direct
label, because hue alone fails for colour-blind readers.

## Checks run

`python3 scripts/validate_contrast.py web/design/tokens.json` passes all
required pairs in both modes. Lowest required ratio is the control border at
3.35:1 light and 3.42:1 dark.

`python3 scripts/validate_tokens.py web/design/tokens.json` reports 155 valid
tokens.

`node scripts/build_tokens.mjs --in web/design/tokens.json --out web/design/theme.css --check`
reports every alias resolved and no token dropped.

Not yet run: any render gate. There is no page to render until the web app
exists.
