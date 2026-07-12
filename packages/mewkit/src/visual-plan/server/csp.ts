/**
 * Content-Security-Policy for the Visual Plan studio's served pages.
 *
 * Exact policy (red-team M4 — be exact, not hand-wavy). `script-src 'self'` keeps
 * the XSS-relevant surface strict; `style-src` allows `'unsafe-inline'` only
 * because Vite's production output injects inline styles (the accepted trade-off).
 * `img-src ... data:` permits inlined data-URI assets; `connect-src 'self'` keeps
 * fetches loopback-only. A server test asserts this header VERBATIM.
 */

export const STUDIO_CSP =
	"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'";

/** Baseline security headers applied to every studio response. */
export const SECURITY_HEADERS: Record<string, string> = {
	"Content-Security-Policy": STUDIO_CSP,
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "no-referrer",
};
