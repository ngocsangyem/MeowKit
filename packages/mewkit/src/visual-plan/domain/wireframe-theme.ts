/**
 * Shared wireframe theme — the SINGLE source of truth for how sanitized
 * `.wf-*` semantic HTML looks, consumed by BOTH renderers (same pattern as
 * sanitizer-config.ts): the studio injects it at boot, `export --format html`
 * embeds it in the exported page. One theme, two surfaces, no drift.
 *
 * Visual language follows the agent-native plan renderer (ISC), re-expressed
 * for MeowKit's vocabulary: a scoped ink/paper/card/accent token palette with
 * soft variants, hand-drawn font by DEFAULT (sketchy is the primary register;
 * `[data-style="clean"]` swaps to the sans stack), 1.4px strokes, 9px radii,
 * and a `[data-rough-ready]` hook that hides crisp borders once the rough.js
 * overlay has redrawn them so outlines are never doubled.
 *
 * Pure data — no DOM, no imports — so the Node exporter and the Vite bundle
 * can both consume it.
 */

export const WIREFRAME_THEME_CSS = `
/* ---- tokens (scoped to .wf-root; light + dark) ---- */
.wf-root {
  --wf-ink: #222b38; --wf-ink-soft: #6b7684; --wf-line: #d3d9e0; --wf-sketch: #94a0ad;
  --wf-paper: #ffffff; --wf-card: #f6f8fa;
  --wf-accent: #4c6ef5; --wf-accent-fg: #ffffff; --wf-accent-soft: rgba(76, 110, 245, 0.12);
  --wf-warn: #d64545; --wf-warn-soft: rgba(214, 69, 69, 0.12); --wf-ok: #2f9e63;
  --wf-radius: 9px; --wf-stroke: 1.4px;
  --wf-font-hand: "Architects Daughter", "Comic Sans MS", "Bradley Hand", "Marker Felt", cursive;
  --wf-font-clean: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --wf-font: var(--wf-font-hand);
  background: var(--wf-paper); color: var(--wf-ink);
  font-family: var(--wf-font); font-size: 14px; line-height: 1.45;
  padding: 14px; height: 100%; overflow: hidden; position: relative;
}
.wf-root, .wf-root * { box-sizing: border-box; min-width: 0; }
[data-style="clean"] .wf-root { --wf-font: var(--wf-font-clean); }
@media (prefers-color-scheme: dark) {
  .wf-root {
    --wf-ink: #e9edf3; --wf-ink-soft: #93a0ae; --wf-line: #2c3646; --wf-sketch: #5d6a7a;
    --wf-paper: #171d26; --wf-card: #1e2733;
    --wf-accent: #7c9aff; --wf-accent-fg: #10141c; --wf-accent-soft: rgba(124, 154, 255, 0.16);
    --wf-warn: #ef7070; --wf-warn-soft: rgba(239, 112, 112, 0.16); --wf-ok: #52c184;
  }
}

/* ---- bare semantic elements ---- */
.wf-root h1 { font-size: 21px; font-weight: 700; line-height: 1.15; margin: 0 0 8px; }
.wf-root h2 { font-size: 17px; font-weight: 700; line-height: 1.2; margin: 0 0 6px; }
.wf-root h3, .wf-root h4, .wf-root h5, .wf-root h6 { font-size: 14px; font-weight: 700; margin: 0 0 4px; }
.wf-root p { margin: 0 0 8px; }
.wf-root small { color: var(--wf-ink-soft); font-size: 12.5px; }
.wf-root a { color: var(--wf-accent); text-decoration: none; }
.wf-root hr { border: 0; border-top: var(--wf-stroke) solid var(--wf-line); margin: 10px 0; }
.wf-root ul, .wf-root ol { margin: 0 0 8px; padding-left: 1.2em; }
.wf-root li { margin: 2px 0; }
.wf-root label { font-size: 12.5px; font-weight: 700; color: var(--wf-ink-soft); }
.wf-root blockquote { margin: 0 0 8px; padding: 6px 12px; border-left: 3px solid var(--wf-line); color: var(--wf-ink-soft); }
.wf-root code, .wf-root pre { font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; background: var(--wf-card); border-radius: 5px; }
.wf-root pre { padding: 8px 10px; overflow: auto; margin: 0 0 8px; }
.wf-root table { width: 100%; border-collapse: collapse; margin: 0 0 8px; font-size: 13px; }
.wf-root th { text-align: left; font-weight: 700; border-bottom: var(--wf-stroke) solid var(--wf-line); padding: 6px 8px; }
.wf-root td { padding: 6px 8px; border-bottom: 1px solid var(--wf-line); }
.wf-root figure { margin: 0 0 8px; }
.wf-root figcaption { font-size: 12.5px; color: var(--wf-ink-soft); }

/* ---- structure ---- */
.wf-root .wf-screen { display: flex; flex-direction: column; gap: 10px; min-height: 100%; }
.wf-root .wf-topbar, .wf-root header { display: flex; align-items: center; gap: 10px; border-bottom: var(--wf-stroke) solid var(--wf-line); padding-bottom: 8px; }
.wf-root .wf-topbar :is(h1, h2, h3, p), .wf-root header :is(h1, h2, h3, p) { margin: 0; }
.wf-root .wf-content, .wf-root main { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; }
.wf-root footer, .wf-root .wf-footer { display: flex; align-items: center; gap: 10px; border-top: var(--wf-stroke) solid var(--wf-line); padding-top: 8px; margin-top: auto; }
.wf-root nav, .wf-root .wf-nav { display: flex; align-items: center; gap: 12px; }
.wf-root aside, .wf-root .wf-sidebar { display: flex; flex-direction: column; gap: 8px; border-right: var(--wf-stroke) solid var(--wf-line); padding-right: 10px; }
.wf-root .wf-row { display: flex; align-items: center; gap: 8px; }
.wf-root .wf-col { display: flex; flex-direction: column; gap: 8px; }
.wf-root .wf-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.wf-root .wf-spacer { flex: 1; }

/* ---- surfaces & controls ---- */
.wf-root .wf-card, .wf-root .wf-box, .wf-root .wf-panel {
  background: var(--wf-card); border: var(--wf-stroke) solid var(--wf-line);
  border-radius: var(--wf-radius); padding: 12px;
}
.wf-root .wf-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font: inherit; font-weight: 700; color: var(--wf-ink); background: var(--wf-paper);
  border: var(--wf-stroke) solid var(--wf-line); border-radius: var(--wf-radius);
  padding: 7px 14px; text-decoration: none; cursor: default; width: fit-content;
}
.wf-root .wf-button:is(.primary, .wf-primary) {
  background: var(--wf-accent); border-color: var(--wf-accent); color: var(--wf-accent-fg);
}
.wf-root .wf-input, .wf-root .wf-field, .wf-root .wf-select, .wf-root .wf-textarea {
  display: flex; align-items: center; min-height: 34px; width: 100%;
  color: var(--wf-ink-soft); background: var(--wf-card);
  border: var(--wf-stroke) solid var(--wf-line); border-radius: var(--wf-radius); padding: 6px 10px;
}
.wf-root .wf-textarea { min-height: 64px; align-items: flex-start; }
.wf-root .wf-form { display: flex; flex-direction: column; gap: 8px; }
.wf-root .wf-checkbox, .wf-root .wf-radio {
  display: inline-block; width: 15px; height: 15px; flex: 0 0 auto;
  border: var(--wf-stroke) solid var(--wf-sketch); background: var(--wf-paper);
}
.wf-root .wf-checkbox { border-radius: 4px; }
.wf-root .wf-radio { border-radius: 999px; }

/* ---- chips, badges, status ---- */
.wf-root :is(.wf-badge, .wf-chip, .wf-pill, .wf-tag) {
  display: inline-flex; align-items: center; gap: 5px; width: fit-content; max-width: 100%;
  border: var(--wf-stroke) solid var(--wf-line); border-radius: 999px;
  padding: 2px 10px; font-size: 12.5px; background: var(--wf-paper);
}
.wf-root :is(.wf-badge, .wf-chip, .wf-pill, .wf-tag).accent { border-color: var(--wf-accent); color: var(--wf-accent); background: var(--wf-accent-soft); }
.wf-root .wf-muted { color: var(--wf-ink-soft); }
.wf-root .wf-hint { color: var(--wf-ink-soft); font-size: 12.5px; }
.wf-root .wf-error { color: var(--wf-warn); }
.wf-root :is(.wf-alert, .wf-banner) { background: var(--wf-warn-soft); border: var(--wf-stroke) solid var(--wf-warn); border-radius: var(--wf-radius); padding: 8px 12px; color: var(--wf-warn); }

/* ---- lists ---- */
.wf-root .wf-list { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.wf-root .wf-list-item {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0;
  background: var(--wf-card); border: var(--wf-stroke) solid var(--wf-line);
  border-radius: var(--wf-radius); padding: 9px 12px;
}

/* ---- media & placeholders ---- */
.wf-root :is(.wf-image, .wf-img, .wf-media) {
  display: block; min-height: 84px; background: var(--wf-card);
  background-image: linear-gradient(to top right, transparent 49.55%, var(--wf-line) 49.55%, var(--wf-line) 50.45%, transparent 50.45%),
    linear-gradient(to bottom right, transparent 49.55%, var(--wf-line) 49.55%, var(--wf-line) 50.45%, transparent 50.45%);
  border: var(--wf-stroke) solid var(--wf-line); border-radius: var(--wf-radius);
}
.wf-root .wf-avatar {
  display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
  width: 32px; height: 32px; border-radius: 999px; font-size: 12px; font-weight: 700;
  background: var(--wf-card); border: var(--wf-stroke) solid var(--wf-line);
}
.wf-root .wf-loading {
  display: block; height: 12px; width: 70%; border-radius: 999px; border: 0;
  background: var(--wf-line);
}
@media (prefers-reduced-motion: no-preference) {
  .wf-root .wf-loading { animation: wf-pulse 1.6s ease-in-out infinite; }
}
@keyframes wf-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

/* ---- rough handoff: once the overlay has drawn hand-drawn outlines, hide the
   crisp borders it replaced (fills and text stay) so nothing is doubled. ---- */
[data-rough-ready="true"] .wf-root :is(
  .wf-button, .wf-input, .wf-field, .wf-select, .wf-textarea,
  .wf-card, .wf-box, .wf-panel, .wf-badge, .wf-chip, .wf-pill, .wf-tag,
  .wf-list-item, .wf-avatar, .wf-image, .wf-img, .wf-media, .wf-alert, .wf-banner,
  .wf-checkbox, .wf-radio, hr
) { border-color: transparent !important; }
`;

/**
 * Class names the theme MUST style (superset of the generation contract's
 * common vocabulary). The coverage test asserts each appears in the CSS so a
 * generated artifact can never render a bare, unstyled block again.
 */
export const WIREFRAME_THEME_CLASSES: readonly string[] = [
	"wf-screen",
	"wf-topbar",
	"wf-content",
	"wf-footer",
	"wf-nav",
	"wf-sidebar",
	"wf-row",
	"wf-col",
	"wf-grid",
	"wf-spacer",
	"wf-card",
	"wf-box",
	"wf-panel",
	"wf-button",
	"wf-input",
	"wf-field",
	"wf-select",
	"wf-textarea",
	"wf-form",
	"wf-checkbox",
	"wf-radio",
	"wf-badge",
	"wf-chip",
	"wf-pill",
	"wf-tag",
	"wf-muted",
	"wf-hint",
	"wf-error",
	"wf-alert",
	"wf-banner",
	"wf-list",
	"wf-list-item",
	"wf-image",
	"wf-img",
	"wf-media",
	"wf-avatar",
	"wf-loading",
];
