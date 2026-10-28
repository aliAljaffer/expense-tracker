#!/usr/bin/env python3
"""Generate the README header from the brand mark and tokens.

Text is shaped with HarfBuzz and written as outlines, so the files need no font
at render time. Colours come from web/design/tokens.json, never from this file.

    pip install fonttools brotli uharfbuzz
    python3 scripts/build-header.py
"""

import io
import json
import re
import sys
import tempfile
import urllib.request
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
TOKENS = ROOT / "web/design/tokens.json"
ICON = ROOT / "web/public/brand/icon.svg"
OUT = ROOT / "docs/assets"

FONT_URL = (
    "https://fonts.gstatic.com/s/bricolagegrotesque/v9/"
    "3y9K6as8bTXq_nANBjzKo3IeZx8z6up5BeSl9D4dj_x9PpZBMlGIInHWVyNJ.woff2"
)

W, H = 1280, 360
PAD = 40
TILE = 92
TILE_Y = 70
WORD_SIZE = 112
WORD_TRACK = -0.02
WORD_GAP = TILE // 2
TAGLINE = "Private, self-hosted analysis of Saudi bank statements."
TAG_SIZE = 26
TAG_BASELINE = 248
META_LEFT = "Import, reconcile, explain."
META_RIGHT = "alialjaffer/grooszy"
META_SIZE = 18
META_BASELINE = 332
RULE_Y = 302

# size, weight per role: the wordmark is the brand cut, the rest is text weight.
ROLES = {
    "wordmark": (WORD_SIZE, 600),
    "tagline": (TAG_SIZE, 400),
    "meta": (META_SIZE, 500),
}

THEMES = {
    "light": {
        "page": "semantic.surface.page",
        "wordmark": "semantic.text.primary",
        "tagline": "semantic.text.secondary",
        "meta": "semantic.text.secondary",
        "rule": "semantic.border.default",
    },
    "dark": {
        "page": "dark.surface.page",
        "wordmark": "dark.text.primary",
        "tagline": "dark.text.secondary",
        "meta": "dark.text.secondary",
        "rule": "dark.border.default",
    },
}


def resolve(tokens, path):
    node = tokens
    for key in path.split("."):
        node = node[key]
    value = node["$value"]
    return resolve(tokens, value[1:-1]) if value.startswith("{") else value


def load_faces():
    cache = Path(tempfile.gettempdir()) / "grooszy-bricolage.woff2"
    if not cache.exists():
        urllib.request.urlretrieve(FONT_URL, cache)

    faces = {}
    for weight in {w for _, w in ROLES.values()}:
        font = TTFont(cache)
        font = instantiateVariableFont(font, {"wght": weight, "opsz": 12})
        font.flavor = None
        buf = io.BytesIO()
        font.save(buf)
        faces[weight] = (font, hb.Font(hb.Face(buf.getvalue())))
    return faces


def round_path(d):
    def fix(m):
        v = round(float(m.group()), 1)
        return str(int(v)) if v == int(v) else f"{v:g}"

    return re.sub(r"-?\d+\.\d+(?:e-?\d+)?", fix, d)


def shape(text, role, tracking, face):
    font, hb_font = face
    size = ROLES[role][0]
    scale = size / font["head"].unitsPerEm
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hb_font, buf, {})

    glyphs, pen_x = font.getGlyphSet(), 0.0
    spans = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        x = (pen_x + pos.x_offset) * scale
        y = -pos.y_offset * scale
        spans.append((glyphs[font.getGlyphName(info.codepoint)], x, y))
        pen_x += pos.x_advance + tracking * font["head"].unitsPerEm
    return spans, scale


def outline(text, role, tracking=0.0):
    face = FACES[ROLES[role][1]]
    spans, scale = shape(text, role, tracking, face)
    parts = []
    for glyph, x, y in spans:
        pen = SVGPathPen(face[0].getGlyphSet())
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x, y)))
        parts.append(round_path(pen.getCommands()))
    return " ".join(p for p in parts if p)


def bounds(text, role, tracking=0.0):
    face = FACES[ROLES[role][1]]
    spans, scale = shape(text, role, tracking, face)
    pen = BoundsPen(face[0].getGlyphSet())
    for glyph, x, y in spans:
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x, y)))
    return pen.bounds


def tile(size):
    body = re.sub(r"<title>.*?</title>", "", ICON.read_text(), flags=re.S)
    body = re.search(r"<svg[^>]*>(.*)</svg>", body, re.S).group(1)
    body = re.sub(r"\n\s*\n", "\n", body.strip())
    return f'<g transform="scale({size / 256:.6f})">{body}</g>'


def build(theme, tokens):
    c = {role: resolve(tokens, key) for role, key in THEMES[theme].items()}
    _, y0, _, y1 = bounds("grooszy", "wordmark", WORD_TRACK)
    word_y = TILE_Y + TILE / 2 - (y0 + y1) / 2
    meta_w = bounds(META_RIGHT, "meta")[2]

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="t d">
  <title id="t">grooszy</title>
  <desc id="d">Lime tile with the ink g, the grooszy wordmark, and the line: Private, self-hosted analysis of Saudi bank statements.</desc>
  <rect width="{W}" height="{H}" fill="{c['page']}"/>
  <g transform="translate({PAD} {TILE_Y})">{tile(TILE)}</g>
  <g fill="{c['wordmark']}"><path transform="translate({PAD + TILE + WORD_GAP} {word_y:.1f})" d="{outline('grooszy', 'wordmark', WORD_TRACK)}"/></g>
  <g fill="{c['tagline']}"><path transform="translate({PAD} {TAG_BASELINE})" d="{outline(TAGLINE, 'tagline', -0.01)}"/></g>
  <rect x="{PAD}" y="{RULE_Y}" width="{W - 2 * PAD}" height="1" fill="{c['rule']}"/>
  <g fill="{c['meta']}">
    <path transform="translate({PAD} {META_BASELINE})" d="{outline(META_LEFT, 'meta')}"/>
    <path transform="translate({W - PAD - meta_w:.1f} {META_BASELINE})" d="{outline(META_RIGHT, 'meta')}"/>
  </g>
</svg>
"""


def main():
    global FACES
    tokens = json.loads(TOKENS.read_text())
    FACES = load_faces()

    OUT.mkdir(parents=True, exist_ok=True)
    for theme in THEMES:
        svg = build(theme, tokens)
        path = OUT / f"header-{theme}.svg"
        path.write_text(svg)
        right = PAD + TILE + WORD_GAP + bounds("grooszy", "wordmark", WORD_TRACK)[2]
        assert right < W - PAD, f"wordmark overflows: {right:.1f}"
        assert PAD + bounds(TAGLINE, "tagline", -0.01)[2] < W - PAD, "tagline overflows"
        print(f"{path.relative_to(ROOT)}  {len(svg)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
