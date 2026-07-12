/**
 * Host header guard — defense against DNS rebinding.
 *
 * Behavior extracted verbatim from the loopback server's private host check:
 * a request is allowed only when its `Host` header is the loopback/localhost
 * authority (with or without the bound port). The `Host` header may arrive
 * mixed-case from proxies, so this uses a Set of exact expected values plus the
 * bare-host fallback — it does NOT lowercase (that is the Origin guard's job).
 */

import { LOOPBACK_HOST } from "./constants.js";

/** True when `host` is an allowed loopback authority for `port`. Missing host ⇒ false. */
export function isHostAllowed(host: string | undefined, port: number): boolean {
	if (!host) return false;
	const expected = new Set([`${LOOPBACK_HOST}:${port}`, `localhost:${port}`]);
	return expected.has(host) || host === LOOPBACK_HOST || host === "localhost";
}
