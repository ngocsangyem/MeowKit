/**
 * Shared wireframe-sanitizer allowlist config.
 *
 * This module is the SINGLE source of truth for the sanitizer boundary and is
 * imported by BOTH sides (red-team H2): the Node save-time sanitizer here in
 * Phase 1 (jsdom-backed DOMPurify) and the browser render-time sanitizer in
 * Phase 4 (native-DOM DOMPurify). Two parsers over ONE allowlist is the only
 * way to keep the reject-at-save and re-sanitize-at-render decisions identical.
 *
 * It is pure data — no DOM, no jsdom, no dompurify import — so both environments
 * can consume it without pulling in the other's engine.
 *
 * Reject semantics (not repair): the caller sanitizes with this config, then
 * diffs the sanitized output against the DOM-normalized input; ANY delta is a
 * rejection with a JSON path. This config's job is only to define what "safe"
 * means; the diff enforces reject-not-repair.
 */

/**
 * Semantic wireframe tag vocabulary. Anything outside this list is stripped by
 * DOMPurify, which the reject-diff then turns into a hard error. Interactive
 * form controls (`input`, `textarea`, `select`, `form`) are intentionally
 * absent — wireframes represent them as `.wf-*`-classed structural elements,
 * never live controls.
 */
export const WIREFRAME_ALLOWED_TAGS: readonly string[] = [
	"section", "header", "footer", "main", "nav", "aside", "article",
	"div", "span", "p",
	"h1", "h2", "h3", "h4", "h5", "h6",
	"ul", "ol", "li", "dl", "dt", "dd",
	"a", "strong", "em", "small", "b", "i", "u", "code", "pre", "blockquote",
	"figure", "figcaption", "hr", "br",
	"table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
	"label",
];

/**
 * Allowed attributes. `class` carries the `.wf-*` vocabulary; `href` is allowed
 * but scheme-restricted by `WIREFRAME_ALLOWED_URI_REGEXP`. `style` is NOT
 * allowed (inline CSS is how fixed-position / z-index / font-face attacks
 * arrive), so any `style=` attribute is stripped and the diff rejects it.
 */
export const WIREFRAME_ALLOWED_ATTR: readonly string[] = ["class", "href", "title", "role"];

/**
 * URL scheme allowlist for `href`. Permits http(s), mailto, in-page anchors,
 * and site-relative paths (a single leading `/`). Everything else —
 * `javascript:`, `data:`, `vbscript:`, tab/entity-obfuscated schemes, AND
 * protocol-relative `//host` (which resolves to an external origin) — is
 * rejected by DOMPurify and the diff.
 */
export const WIREFRAME_ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto):|#|\/(?!\/))/i;

/**
 * The DOMPurify config object, identical on both sides.
 *
 * NOTE: `USE_PROFILES` is deliberately NOT set — DOMPurify IGNORES
 * `ALLOWED_TAGS`/`ALLOWED_ATTR` whenever a profile is present, and the built-in
 * html profile permits form controls. The explicit `ALLOWED_TAGS` allowlist is
 * strictly stronger: anything outside it (form controls, SVG, MathML, script)
 * is stripped, which the reject-diff turns into a hard error. Data/ARIA attrs
 * are off; `style` is force-forbidden even though it is already off-allowlist.
 */
export const WIREFRAME_SANITIZE_CONFIG = {
	ALLOWED_TAGS: [...WIREFRAME_ALLOWED_TAGS],
	ALLOWED_ATTR: [...WIREFRAME_ALLOWED_ATTR],
	ALLOW_DATA_ATTR: false,
	ALLOW_ARIA_ATTR: false,
	FORBID_ATTR: ["style"],
	FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "svg", "math"],
	ALLOWED_URI_REGEXP: WIREFRAME_ALLOWED_URI_REGEXP,
	WHOLE_DOCUMENT: false,
};
