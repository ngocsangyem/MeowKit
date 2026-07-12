/**
 * Save-time wireframe sanitizer (Node side, jsdom-backed DOMPurify).
 *
 * Engine decision (red-team H2): ONE vetted engine — DOMPurify — on both sides.
 * MeowKit has no HTML parser in runtime deps today; DOMPurify + jsdom are added
 * as runtime deps precisely for this. Regex-only sanitization is forbidden.
 *
 * Reject, not repair: we normalize the input through the DOM (so pure formatting
 * differences — quote style, self-closing, whitespace — do NOT count), then
 * sanitize with the SHARED allowlist config. If the sanitized output differs
 * from the normalized input, the sanitizer removed something unsafe/unlisted and
 * we REJECT with a JSON path. The Phase-4 browser renderer re-runs the identical
 * engine + config; the shared adversarial corpus runs in both environments.
 */

import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { WIREFRAME_SANITIZE_CONFIG } from "../domain/sanitizer-config.js";

// One jsdom window + DOMPurify instance for the process. jsdom is heavy to
// construct; reuse is safe because sanitize() is stateless per call.
const jsdomWindow = new JSDOM("").window;
const purify = createDOMPurify(jsdomWindow as unknown as Parameters<typeof createDOMPurify>[0]);

/** Result of a reject-mode sanitize check. `safe:false` carries a short reason. */
export interface SanitizeCheck {
	safe: boolean;
	reason?: string;
}

/**
 * DOM-normalize `html` so the reject-diff ignores cosmetic reformatting: set it
 * as innerHTML on a detached element and read it back. Both the normalized input
 * and the DOMPurify output pass through this same DOM serialization path.
 */
function domNormalize(html: string): string {
	const el = jsdomWindow.document.createElement("div");
	el.innerHTML = html;
	return el.innerHTML;
}

/**
 * True when `html` is safe under the shared allowlist. Any content DOMPurify
 * would strip (disallowed tag/attr, unsafe URL scheme, event handler, inline
 * style, SVG/MathML) makes it unsafe — the artifact is rejected, never repaired.
 */
export function checkWireframeHtml(html: string): SanitizeCheck {
	const normalized = domNormalize(html);
	const clean = purify.sanitize(html, WIREFRAME_SANITIZE_CONFIG);
	if (clean === normalized) return { safe: true };
	return {
		safe: false,
		reason: "wireframe HTML contains disallowed or unsafe markup (sanitizer would strip content — reject, not repair)",
	};
}
