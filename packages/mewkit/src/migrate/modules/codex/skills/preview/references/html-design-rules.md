# HTML Design Rules

How `--html --explain`, `--html --diagram`, `--html --slides` produce a single self-contained HTML file. Inline CSS and JS; CDN for Mermaid v11, Chart.js v4, and Google Fonts.

## Contents

- Required reads
- Workflow — Think / Structure / Style / Deliver
- Style presets (names only)
- Theme toggle (MANDATORY)
- Zoom and pan engine (for diagrams)
- Slide engine (for slides)
- CDN resources
- Anti-slop quick checklist
- Style preset rotation (persistent state)
- Browser auto-open shell
- Topic-string encoding (security)
- Output checklist

## Required reads

Before generating any HTML output:

- `mk:frontend-design/references/anti-slop-directives.md` — MANDATORY. The 6+ forbidden patterns.
- `references/mermaid-essentials.md` — MANDATORY when the page contains a Mermaid block.

These are CITED, not duplicated here. If `frontend-design`'s anti-slop list grows, this skill picks up the change automatically.

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

## Theme toggle (MANDATORY)

Every HTML artifact MUST include a fixed top-right toggle button with persistent localStorage state. The button is the first child of `<body>`.

CSS variables follow a three-tier pattern:

- `:root` defines light defaults
- `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` honors OS preference unless overridden
- `[data-theme="dark"]` forces dark regardless of OS

CSS:

```css
.theme-toggle {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 300;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-dim);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: background 0.15s, color 0.15s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.theme-toggle:hover { background: var(--surface2); color: var(--text); }
```

HTML + JS:

```html
<button class="theme-toggle" id="themeToggle" title="Toggle theme" aria-label="Toggle light/dark theme"></button>

<script>
(function () {
  var toggle = document.getElementById('themeToggle');
  var saved = localStorage.getItem('theme');
  var initial = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (saved) document.documentElement.setAttribute('data-theme', initial);
  toggle.textContent = initial === 'dark' ? '☀' : '☾';
  toggle.addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme')
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    toggle.textContent = next === 'dark' ? '☀' : '☾';
  });
})();
</script>
```

Symbols: `☀` = sun (shown in dark mode), `☾` = moon (shown in light mode). Unicode dingbats render consistently across platforms; do not use emoji.

## Zoom and pan engine (for diagrams)

For `--html --diagram` and any page with multiple Mermaid diagrams, attach a zoom/pan handler per diagram. Mouse wheel zooms with cursor as anchor; drag pans; `+ / - / 0` keys for keyboard control; reset button returns to 1:1.

CSS:

```css
.diagram-stage {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  min-height: 320px;
  cursor: grab;
}
.diagram-stage.dragging { cursor: grabbing; }
.diagram-canvas {
  transform-origin: 0 0;
  transition: transform 0.05s linear;
  padding: 24px;
  display: inline-block;
}
.diagram-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
  z-index: 10;
}
.diagram-controls button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.diagram-controls button:hover { background: var(--surface); }
```

JS (one IIFE per stage; use `data-zoom-stage` attribute on each `.diagram-stage`):

```html
<script>
(function () {
  var stages = document.querySelectorAll('.diagram-stage');
  stages.forEach(function (stage) {
    var canvas = stage.querySelector('.diagram-canvas');
    var scale = 1, x = 0, y = 0;
    var dragging = false, sx = 0, sy = 0;
    function apply() { canvas.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')'; }
    function reset() { scale = 1; x = 0; y = 0; apply(); }
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = stage.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var delta = e.deltaY < 0 ? 1.1 : 0.9;
      var newScale = Math.max(0.3, Math.min(4, scale * delta));
      x = mx - (mx - x) * (newScale / scale);
      y = my - (my - y) * (newScale / scale);
      scale = newScale;
      apply();
    }, { passive: false });
    stage.addEventListener('mousedown', function (e) {
      dragging = true; sx = e.clientX - x; sy = e.clientY - y;
      stage.classList.add('dragging');
    });
    window.addEventListener('mouseup', function () { dragging = false; stage.classList.remove('dragging'); });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      x = e.clientX - sx; y = e.clientY - sy;
      apply();
    });
    var resetBtn = stage.querySelector('[data-zoom-reset]');
    if (resetBtn) resetBtn.addEventListener('click', reset);
    var zoomIn = stage.querySelector('[data-zoom-in]');
    if (zoomIn) zoomIn.addEventListener('click', function () { scale = Math.min(4, scale * 1.2); apply(); });
    var zoomOut = stage.querySelector('[data-zoom-out]');
    if (zoomOut) zoomOut.addEventListener('click', function () { scale = Math.max(0.3, scale * 0.83); apply(); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '+' || e.key === '=') document.querySelector('[data-zoom-in]')?.click();
    if (e.key === '-') document.querySelector('[data-zoom-out]')?.click();
    if (e.key === '0') document.querySelector('[data-zoom-reset]')?.click();
  });
})();
</script>
```

## Slide engine (for slides)

For `--html --slides`, snap-scroll between sections marked `<section class="slide">`. Track current slide via IntersectionObserver; arrow keys navigate; progress dots in fixed bottom bar.

CSS:

```css
html, body { scroll-snap-type: y mandatory; height: 100%; overflow-y: scroll; }
.slide { height: 100vh; scroll-snap-align: start; padding: 40px 60px; box-sizing: border-box; }
.slide-progress { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 200; }
.slide-progress .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border); transition: background 0.15s; }
.slide-progress .dot.active { background: var(--text); }
```

JS:

```html
<script>
(function () {
  var slides = document.querySelectorAll('.slide');
  var progress = document.querySelector('.slide-progress');
  if (progress) {
    slides.forEach(function () { var d = document.createElement('span'); d.className = 'dot'; progress.appendChild(d); });
  }
  var dots = progress ? progress.querySelectorAll('.dot') : [];
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var idx = Array.prototype.indexOf.call(slides, entry.target);
        dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
      }
    });
  }, { threshold: 0.5 });
  slides.forEach(function (s) { io.observe(s); });
  document.addEventListener('keydown', function (e) {
    var current = Array.prototype.findIndex.call(dots, function (d) { return d.classList.contains('active'); });
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      slides[Math.min(slides.length - 1, current + 1)]?.scrollIntoView({ behavior: 'smooth' });
    }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      slides[Math.max(0, current - 1)]?.scrollIntoView({ behavior: 'smooth' });
    }
  });
})();
</script>
```

## CDN resources

Pin all versions; do not load `latest`.

| Library | URL | Notes |
|---|---|---|
| Mermaid v11 | `https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs` | Use `<script type="module">` |
| Chart.js v4 | `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js` | Optional; only for KPI charts |
| Google Fonts | `https://fonts.googleapis.com/css2?family=...&display=swap` | Pair from `mk:ui-design-system/assets/typography.csv` |

When Mermaid releases v12, bump this URL AND `references/mermaid-essentials.md` → "Pinned version" in the same commit.

## Anti-slop quick checklist

Full rules in `mk:frontend-design/references/anti-slop-directives.md`. Quick gut check:

- No Inter, Roboto, or system-ui alone for body font
- No indigo/violet (`#8b5cf6`, `#7c3aed`) as accent
- No gradient text on headings (`background-clip: text`)
- No animated glowing box-shadows
- No emoji in section headers
- No three-dot window chrome on code blocks

## Style preset rotation (persistent state)

To force aesthetic variety between consecutive runs, rotate through palette + typography combinations. State lives in `the project environment/preview/style-rotation.json` per `skill-authoring-rules.md` Rule 2.

```bash
ROTATION_DIR="the project environment:-}"
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

When `the project environment` is unset, the deterministic-hash fallback ensures variety across topics without persisting state. This is a graceful degradation, not silent failure.

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
- [ ] Theme toggle button is first child of `<body>`
- [ ] Theme toggle persists choice via localStorage
- [ ] No console errors when opened in Chrome / Safari
- [ ] No horizontal scroll on the page (tables wrapped in scroll containers OK)
- [ ] Mermaid diagrams render (zoom/pan working when applicable)
- [ ] Anti-slop checklist passes (Inter/violet/gradient text/glow/emoji headers/3-dot chrome — none present)
- [ ] Topic string was encoded for the right context
- [ ] CDN URLs are version-pinned
- [ ] File size ≤ 500 KB
