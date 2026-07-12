/**
 * Origin header guard — exact-match allowlist for cross-origin write requests.
 *
 * Behavior extracted verbatim from the loopback write pipeline: case-insensitive
 * EXACT equality against the two allowed origins. No prefix-match, no contains,
 * no regex. Distinct from the Host guard — the `Origin` header is always
 * lowercase per the browser spec, so this lowercases and compares exact strings.
 */

import { LOOPBACK_HOST } from "./constants.js";

/** True when `origin` is exactly the loopback or localhost origin for `port`. */
export function isOriginAllowed(origin: string, port: number): boolean {
	const lower = origin.toLowerCase();
	return lower === `http://${LOOPBACK_HOST}:${port}` || lower === `http://localhost:${port}`;
}
