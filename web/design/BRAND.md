# Brand

The mark is the lowercase g of Bricolage Grotesque, outlined and set on a lime
tile. The same face sets the wordmark and the whole interface, so the product and
the logo are one typeface and one palette.

## Mark

| Element | Value |
|---|---|
| Source glyph | Bricolage Grotesque, wght 600, opsz 12, wdth 100 |
| Form | outlined vector, no live text in the master |
| Tile | 256 square, corner radius 57.6 (22.5%) |
| Glyph height on tile | 176 units, centred |
| Tile gap | 40 units above and below the glyph |

The glyph is the font's own shape, not a redrawing: `mark.svg` and `icon.svg` are
generated from the variable font with `fontTools`, so every curve matches the
type. At 16 px the g is dense; the tile carries the recognition there, and the
letter reads from 20 px up.

## Colour

Lime is a surface, never text. Ink on lime is 12.25:1; lime on white is 1.44:1,
so a lime g on a light page is a misuse.

| Role | Light | Dark | Ratio |
|---|---|---|---|
| Tile | `#a3e635` lime | `#a3e635` | 12.25:1 with ink |
| Glyph on tile | `#14140f` ink | `#14140f` | |
| Mark on page | `#14140f` ink | `#a3e635` lime | 12.8:1 lime on `#0b0f0c` |

The tile is the constant. It does not invert in dark mode; the ink glyph stays
legible on lime on either page.

## Lockup

Horizontal only. Tile at `--size-icon-lg` (24 px), gap of half the tile (12 px),
wordmark at 18 px, weight 600, tracking `-0.02em`, lowercase.

The wordmark is type, not drawn: Bricolage Grotesque at weight 600, served
self-hosted by `next/font` from the `--font-bricolage` variable and used through
`--font-sans`. The header sets it live, so it stays selectable and screen readers
read one word.

Clear space: half the tile on every side. Minimum sizes: tile 16 px, lockup
120 px wide.

## Type

One family for the whole product: Bricolage Grotesque, SIL Open Font License 1.1,
from Google Fonts. Variable axes `wght` 200 to 800, `opsz` 12 to 96, `wdth` 75 to
100. `next/font` downloads it at build and serves it from the app's own origin, so
no page makes a request to Google. The `opsz` axis stays live, so body copy is
set at the text cut and display type at the display cut. The family has tabular
figures (`tnum`), which the money columns rely on.

## Files

Served from `/brand/`.

| File | Use |
|---|---|
| `mark.svg` | Master mark, ink, transparent |
| `grooszy-white.svg` | Reversed mark for dark and photographic grounds |
| `grooszy-mono-a3e635.svg` | Lime mark for dark grounds |
| `grooszy-black.svg` | One-colour print and engraving |
| `icon.svg` | Tile, rounded, for the SVG favicon and docs |
| `favicon.ico` | 16, 32, 48 px |
| `apple-touch-icon.png` | 180 px |
| `icon-192.png`, `icon-512.png` | Web app manifest |
| `site.webmanifest` | Install metadata |

## Misuse

No gradient, shadow, outline, or glow on the tile or the mark. Do not stretch
the tile, change its corner ratio, or place the g on a tile of another colour.
Do not set the wordmark in another face or in caps. Do not redraw the g: it is a
type glyph, and a redrawing is what it looked like before.

## Not done

No trademark search. No print masters: the palette is RGB only, so ask for a
CMYK conversion before anything goes to a press. The wordmark is not outlined.
