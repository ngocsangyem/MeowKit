# Editorial HTML Report

Use this reference only when `mk:brainstorming --html` is requested. Author one additional `.html` file next to the markdown brainstorm report, inline (do NOT route through `mk:preview`). The HTML must be self-contained: inline CSS and JavaScript in one file, no build step, no network requirement for layout (web fonts are optional; system fallbacks must work offline).

Source style: long-form editorial / investor-memo / printed-magazine aesthetic.

## Design Philosophy

- Editorial print, not slide deck. Think serious business magazine translated to scrollable web.
- Restraint over decoration. No gradients, no shadows, no rounded corners.
- Hairline rules and whitespace create structure.
- Serif display type carries authority; mono labels carry metadata and taxonomy.
- Paper-warm background, not pure white.
- Red accent is a scalpel: use only for italic emphasis, eyebrows, callouts, and active states.

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
- Accent appears on italic serif emphasis, eyebrows, numbers, left borders, and active nav/timeline states.
- Use `--gold` only for optional/future track markers.
- Declare serif/sans/mono with system fallbacks so the report renders without a font CDN; a font `@import` is optional and, if added, is the only external request.

## Typography

- Cover title: serif, `clamp(60px, 11vw, 180px)`, weight 300, line-height 0.92.
- Display heading: serif, `clamp(48px, 7vw, 110px)`, weight 300.
- Section heading: serif, `clamp(32px, 4.5vw, 64px)`, weight 400.
- Pull quote: serif italic, `clamp(28px, 3.6vw, 48px)`, weight 300.
- Lead paragraph: serif, `clamp(18px, 1.6vw, 22px)`, line-height 1.5.
- Body: sans, 15px, line-height 1.65.
- Eyebrows, labels, metadata: mono, uppercase, 10-12px, letter spacing 0.12-0.18em.

Emphasis pattern:

```html
<h2>One clear thesis.<br><em>One red italic phrase.</em></h2>
```

Use exactly one red italic emphasis phrase per major heading when useful.

## Layout

- Each section is `.slide`: `min-height: 100vh; padding: 60px 8vw; border-bottom: 1px solid var(--hairline);`.
- Inner `.container`: `max-width: 1240px; margin: 0 auto;`.
- Mobile under 900px: reduce padding to `60px 6vw`; collapse multi-column grids to one column.
- Use asymmetry for two-column grids: `grid-template-columns: 1fr 1.2fr; gap: 80px;`.
- Every non-cover section carries:
  - Top-left `.slide-tag`: `■ 02 · Section name` in mono red.
  - Top-right `.slide-num`: `03 / 10` in mono muted.

## Required Report Sections

Map these 1:1 to the markdown report's decision sections so the HTML carries the same content. Adapt to the brainstorm, but prefer this flow:

1. Cover: topic, date, repo/project, mode flags.
2. Problem: the actual problem statement; if decompression triggered, show the decompressed problem.
3. Evidence: codebase facts, user signal, constraints, evidence status.
4. Options: 2-3 approaches with trade-offs.
5. Recommendation: chosen path and rationale.
6. Risks: assumptions, failure modes, validation plan.
7. Handoff: `mk:plan-creator` handoff packet and report links.
8. Closing: crisp decision statement, plus any unresolved questions.

## Components

Cards:

```css
.card { background: var(--paper-warm); padding: 36px 32px; border: 1px solid var(--hairline); }
.card.dark { background: var(--ink); color: var(--paper); border-color: var(--ink); }
```

- No border-radius. No shadow.
- One dark card per row may be used for the punchline.
- Add a mono `.card-mark` index in the top-right.

Track box:

```css
.track-box { border-left: 3px solid var(--accent); background: var(--paper-warm); padding: 40px 44px; }
```

Use for recommended option, strongest assumption, or validation plan.

Pull quote:

```css
.pull-quote {
  border-left: 2px solid var(--accent);
  padding: 12px 0 12px 40px;
  font: 300 italic clamp(28px, 3.6vw, 48px)/1.25 var(--serif);
}
```

Use at most one per section.

Comparison table:

- Header: mono 10px uppercase, muted.
- Header bottom rule and final row bottom rule: 1.5px solid ink.
- Intermediate rows: hairline dividers.
- First column: serif 500.
- Featured column may use `rgba(184,35,44,0.04)`.

## Motion

Use one reveal primitive only:

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

- Pair every number with a mono uppercase label and one-sentence explanation.
- Use hairlines, whitespace, and typographic hierarchy to structure.
- Keep headings short and declarative.
- HTML-escape any user-supplied content before inserting it into the template.
- Preserve diacritics when non-ASCII text (e.g. Vietnamese) appears in user content.

Don't:

- No emojis.
- No stock icons.
- No gradients.
- No drop shadows.
- No rounded cards.
- No pure white page background.
- No SaaS landing-page hero.

## Minimum Section Template

```html
<section class="slide" id="recommendation">
  <span class="slide-tag">■ 05 · Recommendation</span>
  <span class="slide-num">05 / 08</span>
  <div class="container">
    <div class="reveal">
      <h4>Decision</h4>
      <h2>Build the narrow path.<br><em>Validate the risky premise.</em></h2>
    </div>
    <div class="three-col reveal delay-1" style="margin-top: 60px;">
      <div class="card"><div class="card-mark">01</div><h4>Why</h4><h3>Lowest reversible risk</h3><p>Body.</p></div>
      <div class="card"><div class="card-mark">02</div><h4>Watch</h4><h3>Assumption to test</h3><p>Body.</p></div>
      <div class="card dark"><div class="card-mark">03</div><h4>Next</h4><h3>Plan handoff</h3><p>Body.</p></div>
    </div>
  </div>
</section>
```
