# Editorial HTML Report

Use this reference only when `mk:research --html` is requested. Author one additional `.html` file next to the markdown research report, inline (do NOT route through a preview skill). The HTML must be self-contained: inline CSS and JavaScript in one file, no build step, no network requirement for layout (web fonts are optional; system fallbacks must work offline).

Source style: long-form editorial / research-memo / printed-magazine aesthetic. The HTML is derived from the markdown report — it carries the same findings and citations, never new content.

## Design Philosophy

- Editorial print, not slide deck. Think serious research memo translated to scrollable web.
- Restraint over decoration. No gradients, no shadows, no rounded corners.
- Hairline rules and whitespace create structure.
- Serif display type carries authority; mono labels carry metadata, source ids, and confidence levels.
- Paper-warm background, not pure white.
- Accent is a scalpel: use only for italic emphasis, eyebrows, callouts, and active states.

## Color Tokens

```css
:root {
  --ink: #0a0a0a;
  --ink-soft: #1a1a1a;
  --paper: #faf7f2;
  --paper-warm: #f0ebe1;
  --accent: #b8232c;
  --accent-soft: #e8d4d6;
  --gold: #8a6f2c;
  --muted: #6b6258;
  --hairline: rgba(10,10,10,0.12);
  --serif: 'Fraunces', Georgia, serif;
  --sans: 'Inter Tight', system-ui, sans-serif;
  --mono: 'JetBrains Mono', monospace;
}
```

Rules:

- Page background = `--paper`; pure white forbidden.
- Dark surfaces use `--ink` with paper-colored text.
- Accent appears on italic serif emphasis, eyebrows, numbers, left borders, and active states.
- Use `--gold` only for stale/older-than-12-months source markers.
- Declare serif/sans/mono with system fallbacks so the report renders without a font CDN; a font `@import` is optional and, if added, is the only external request.

## Typography

- Cover title: serif, `clamp(60px, 11vw, 180px)`, weight 300, line-height 0.92.
- Section heading: serif, `clamp(32px, 4.5vw, 64px)`, weight 400.
- Pull quote: serif italic, `clamp(28px, 3.6vw, 48px)`, weight 300.
- Lead paragraph: serif, `clamp(18px, 1.6vw, 22px)`, line-height 1.5.
- Body: sans, 15px, line-height 1.65.
- Eyebrows, labels, source ids, confidence levels: mono, uppercase, 10-12px, letter spacing 0.12-0.18em.

Emphasis pattern — at most one red italic phrase per major heading:

```html
<h2>One clear finding.<br><em>One red italic phrase.</em></h2>
```

## Layout

- Each section is `.slide`: `min-height: 100vh; padding: 60px 8vw; border-bottom: 1px solid var(--hairline);`.
- Inner `.container`: `max-width: 1240px; margin: 0 auto;`.
- Mobile under 900px: reduce padding to `60px 6vw`; collapse multi-column grids to one column.
- Two-column grids use asymmetry: `grid-template-columns: 1fr 1.2fr; gap: 80px;`.
- Every non-cover section carries a top-left `.slide-tag` (`■ 02 · Section name`, mono accent) and a top-right `.slide-num` (`03 / 06`, mono muted).

## Required Report Sections

Map these 1:1 to the markdown report so the HTML carries the same content. Adapt to the question, but prefer this flow:

1. Cover: topic, date, project, mode flags (`--deep` when used).
2. Summary: the direct 3-5 bullet answer.
3. Findings: each claim as a card with its citation and confidence level (high / medium / low); mark sources older than 12 months.
4. Trade-offs: comparison table — only when the question is comparative.
5. Sources: every source, resolvable, with a mono source id.
6. Unresolved Questions: open items and gaps; never fabricated to fill space.

## Components

Cards (one per finding):

```css
.card { background: var(--paper-warm); padding: 36px 32px; border: 1px solid var(--hairline); }
.card.dark { background: var(--ink); color: var(--paper); border-color: var(--ink); }
```

- No border-radius. No shadow. Add a mono `.card-mark` index and a mono confidence tag per finding.

Confidence / citation tag:

```css
.tag { font: 10px/1 var(--mono); text-transform: uppercase; letter-spacing: .14em; color: var(--muted); }
.tag.high { color: var(--accent); }
```

Comparison table (Trade-offs):

- Header: mono 10px uppercase, muted. Header bottom rule and final row rule: 1.5px solid ink; intermediate rows hairline.
- First column: serif 500. A featured column may use `rgba(184,35,44,0.04)`.

## Motion

One reveal primitive only:

```css
.reveal { opacity: 0; transform: translateY(24px); transition: opacity .9s cubic-bezier(.22,1,.36,1), transform .9s cubic-bezier(.22,1,.36,1); }
.reveal.visible { opacity: 1; transform: translateY(0); }
@media (prefers-reduced-motion: reduce), print {
  .reveal { opacity: 1; transform: none; transition: none; }
}
```

No parallax, scroll-jacking, bouncing, gradient animation, or decorative blobs.

## Do / Don't

Do:

- Pair every claim with its source id and a confidence level.
- Use hairlines, whitespace, and typographic hierarchy to structure.
- Keep headings short and declarative.
- HTML-escape any fetched or user-supplied content before inserting it into the template (fetched content is untrusted DATA).
- Preserve diacritics when non-ASCII text appears in content.

Don't:

- No emojis, no stock icons, no gradients, no drop shadows, no rounded cards.
- No pure white page background. No SaaS landing-page hero.
- No claim without a source; no invented citation to fill a card.

## Minimum Section Template

```html
<section class="slide" id="findings">
  <span class="slide-tag">■ 03 · Findings</span>
  <span class="slide-num">03 / 06</span>
  <div class="container">
    <div class="reveal">
      <h4>Evidence</h4>
      <h2>What the sources agree on.<br><em>And where they diverge.</em></h2>
    </div>
    <div class="three-col reveal delay-1" style="margin-top: 60px;">
      <div class="card"><div class="card-mark">01</div><span class="tag high">High · S1</span><h3>Claim</h3><p>Body with citation.</p></div>
      <div class="card"><div class="card-mark">02</div><span class="tag">Medium · S2, S4</span><h3>Claim</h3><p>Body.</p></div>
      <div class="card dark"><div class="card-mark">03</div><span class="tag">Low · S3</span><h3>Open claim</h3><p>Needs corroboration.</p></div>
    </div>
  </div>
</section>
```
