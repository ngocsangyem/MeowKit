/**
 * Render-time wireframe sanitizer (browser side).
 *
 * Same engine (DOMPurify), same allowlist config as the Phase-1 save-time
 * sanitizer — imported from the SHARED module so two parsers can never diverge
 * over one allowlist (red-team H2). The artifact was already reject-validated at
 * save time; re-sanitizing at render is defense in depth. The renderer injects
 * the SANITIZED output (never the raw string), so even a hypothetically-unsafe
 * stored value cannot execute.
 */

import createDOMPurify from "dompurify";
import { WIREFRAME_SANITIZE_CONFIG } from "../../../src/visual-plan/domain/sanitizer-config.js";

const purify = createDOMPurify(window as unknown as Parameters<typeof createDOMPurify>[0]);

export interface SanitizeResult {
	/** Always-safe HTML to inject. */
	html: string;
	/** True when the input was already clean (nothing stripped). */
	clean: boolean;
}

/** DOM-normalize `html` so the clean-check ignores cosmetic reformatting. */
function domNormalize(html: string): string {
	const el = document.createElement("div");
	el.innerHTML = html;
	return el.innerHTML;
}

/**
 * Sanitize wireframe HTML for injection. Returns the sanitized output plus a
 * `clean` flag (false ⇒ the stored HTML would have been stripped — should never
 * happen for a validated artifact, surfaced for diagnostics).
 */
export function sanitizeWireframe(html: string): SanitizeResult {
	const clean = purify.sanitize(html, WIREFRAME_SANITIZE_CONFIG);
	return { html: clean, clean: clean === domNormalize(html) };
}
