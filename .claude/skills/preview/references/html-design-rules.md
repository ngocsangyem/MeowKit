# HTML Design Rules

How `--html --explain`, `--html --diagram`, `--html --slides` produce a single self-contained HTML file. Inline CSS and JS; CDN for Mermaid v11, Chart.js v4, and Google Fonts.

## Contents

- Required reads
- Workflow — Think / Structure / Style / Deliver
- Style presets (names only)
- Theme toggle, zoom/pan and slide engine
- CDN resources
- Anti-slop quick checklist
- Style preset rotation (persistent state)
- Browser auto-open shell
- Topic-string encoding (security)
- Output checklist

## Required reads

Before generating any HTML output:

- the anti-slop-directives reference of `mk:frontend-design` — required. The forbidden patterns.
- `references/mermaid-essentials.md` — required when the page contains a Mermaid block.

These are cited, not duplicated here.

## Workflow — Think / Structure / Style / Deliver

**Think.** Decide content-type routing:

- Mermaid for topology (flowcharts, sequence, ER, state)
- CSS Grid for text-heavy architecture (cards with descriptions)
- HTML `<table>` for data (audits, comparisons, matrices)
- Chart.js for real KPI charts
- Hybrid for 15+ elements: simple Mermaid overview + detailed CSS Grid cards

**Structure.** Pick a section sequence: hero → context → cards / diagram → details → summary. Plan depth tiers (hero / elevated / default / recessed).

**Style.** Pick a font pairing and palette from `mk:ui-design-system` CSVs. Vary from previous outputs (see "Style preset rotation").

**Deliver.** Single self-contained `.html`:

- All CSS inline in `<style>`
- All JS inline in `<script>`
- External resources via CDN only (Mermaid, Chart.js, Google Fonts)
- Theme toggle as the first child of `<body>`
- File size cap: 500 KB

## Style presets (names only)

Pick one; agent fills in the actual CSS by combining the chosen palette + typography from `mk:ui-design-system`.

| Preset | Mood | When to use |
|---|---|---|
| Blueprint | Technical, schematic | Architecture diagrams, data flow |
| Editorial | Magazine, prose-heavy | `--html --explain` long topics |
| Paper / Ink | Print-feel, calm | `--html --slides` for stakeholder reads |
| Terminal Mono | Dense, low-color, monospace | `--html --diff`, KPI dashboards |

The preset name is a directive to the agent; full CSS is composed at generation time using the rotation strategy below.

## Theme toggle, zoom/pan and slide engine

Copy these from the matching `assets/` template (`architecture.html`, `mermaid-flowchart.html`, `slide-deck.html`) and keep their properties. Do not re-derive them.

- **Theme toggle:** a fixed top-right button, first child of `<body>`, with the choice persisted in `localStorage` (wrapped in try/catch, since storage can be blocked). CSS variables in three tiers: `:root` light defaults; `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` honours the OS; `[data-theme="dark"]` forces dark.
- **Zoom and pan (diagrams):** wheel zoom, drag pan, buttons for zoom in, out and reset, and a keyboard path; the diagram stays inside its stage.
- **Slides:** `<section class="slide">` blocks with vertical scroll-snap, current slide tracked with `IntersectionObserver`, arrow-key navigation and a fixed progress bar.

## CDN resources

Pin all versions; do not load `latest`. The version in the `assets/*.html` templates is the pinned one; use it as it is.

| Library | URL | Notes |
|---|---|---|
| Mermaid v11 | `https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs` | Use `<script type="module">` |
| Chart.js v4 | `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js` | Optional; only for KPI charts |
| Google Fonts | `https://fonts.googleapis.com/css2?family=...&display=swap` | Pair from the `mk:ui-design-system` typography.csv |

To bump Mermaid, change the URL in the four `assets/*.html` templates and in this table together.

## Anti-slop quick checklist

Full rules in the anti-slop-directives reference of `mk:frontend-design`. Quick gut check:

- No Inter, Roboto, or system-ui alone for body font
- No indigo/violet (`#8b5cf6`, `#7c3aed`) as accent
- No gradient text on headings (`background-clip: text`)
- No animated glowing box-shadows
- No emoji in section headers
- No three-dot window chrome on code blocks

## Style preset rotation (persistent state)

To force aesthetic variety between consecutive runs, rotate through palette + typography combinations. State lives in `${CLAUDE_PLUGIN_DATA}/preview/style-rotation.json` when the host provides a plugin data directory.

```bash
ROTATION_DIR="${CLAUDE_PLUGIN_DATA:-}"
if [ -n "$ROTATION_DIR" ]; then
  ROTATION_FILE="$ROTATION_DIR/preview/style-rotation.json"
  mkdir -p "$(dirname "$ROTATION_FILE")"
  if [ -f "$ROTATION_FILE" ]; then
    LAST=$(cat "$ROTATION_FILE")
  else
    LAST="{}"
  fi
  # Read last_palette and last_font from JSON; pick a different one
  # Write the new pick back to ROTATION_FILE
else
  # Fallback: deterministic hash of topic-slug picks a preset (varies per topic, not per run)
  HASH=$(printf '%s' "$TOPIC_SLUG" | cksum | awk '{print $1}')
  PRESET_INDEX=$((HASH % 4))
fi
```

When `${CLAUDE_PLUGIN_DATA}` is unset, the deterministic-hash fallback ensures variety across topics without persisting state. This is a graceful degradation, not silent failure.

## Browser auto-open shell

Open the file automatically when a real display is available; otherwise print the path.

```bash
if [ "$(uname -s)" = "Darwin" ]; then
  open "$OUTPUT_PATH"
elif [ -f /proc/version ] && grep -qi microsoft /proc/version; then
  echo "WSL detected — open manually: $OUTPUT_PATH"
elif [ -n "$DISPLAY" ]; then
  xdg-open "$OUTPUT_PATH" 2>/dev/null || echo "Open manually: $OUTPUT_PATH"
else
  echo "Headless — open manually: $OUTPUT_PATH"
fi
```

## Topic-string encoding (security)

User-provided topics interpolate into page titles, hero text, and section headers. Encode per context.

| Context | Encoding | Example |
|---|---|---|
| Element body (`<title>`, `<h1>`, `<p>`) | HTML-entity-encode `< > & " '` | `&lt; &gt; &amp; &quot; &#39;` |
| Attribute (`<meta content="...">`, `<a href="...">`) | HTML attribute-encode (same chars) | escape unmatched quotes too |
| CSS rule (rare) | CSS-escape backslash and quotes | rarely needed |
| JS string literal | AVOID — never interpolate user topic into inline JS strings | use a `data-` attribute and read via `dataset` |

A topic of `</title><script>alert(1)</script>` MUST render as literal text inside `<title>`, never break out.

No `eval`, no `innerHTML` from untrusted source. Output is generated; there is no runtime user-rendered content.

## Output checklist

Before reporting the file path back to the user:

- [ ] HTML5 doctype present (`<!DOCTYPE html>`)
- [ ] Theme toggle button is first child of `<body>` and persists its choice
- [ ] If a browser is available, the file was opened with no console errors; otherwise say that it was not opened
- [ ] No horizontal scroll on the page (tables wrapped in scroll containers OK)
- [ ] Mermaid source follows `mk:mermaidjs-v11` (rendering is not verified without a browser)
- [ ] Anti-slop checklist passes (Inter/violet/gradient text/glow/emoji headers/3-dot chrome — none present)
- [ ] Topic string was encoded for the right context
- [ ] CDN URLs are version-pinned
- [ ] File size ≤ 500 KB
