/**
 * Characterization: Host and Origin guard matrices. These encode the exact
 * allow/deny behavior of the source loopback server so the extracted copies
 * cannot silently drift.
 */

import { describe, expect, it } from "vitest";
import { isHostAllowed } from "../host-guard.js";
import { isOriginAllowed } from "../origin-guard.js";

const PORT = 8080;

describe("isHostAllowed", () => {
	const allowed = [`127.0.0.1:${PORT}`, `localhost:${PORT}`, "127.0.0.1", "localhost"];
	const denied = [
		`evil.test:${PORT}`,
		`127.0.0.1:9999`,
		`localhost:9999`,
		"127.0.0.1.evil.test",
		`http://127.0.0.1:${PORT}`,
		"",
	];

	for (const h of allowed) it(`allows ${JSON.stringify(h)}`, () => expect(isHostAllowed(h, PORT)).toBe(true));
	for (const h of denied) it(`denies ${JSON.stringify(h)}`, () => expect(isHostAllowed(h, PORT)).toBe(false));
	it("denies a missing host header", () => expect(isHostAllowed(undefined, PORT)).toBe(false));
});

describe("isOriginAllowed", () => {
	const allowed = [`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, `HTTP://127.0.0.1:${PORT}`];
	const denied = [
		`https://127.0.0.1:${PORT}`,
		`http://evil.test:${PORT}`,
		`http://127.0.0.1:9999`,
		`http://127.0.0.1:${PORT}/path`,
		"",
	];

	for (const o of allowed) it(`allows ${JSON.stringify(o)}`, () => expect(isOriginAllowed(o, PORT)).toBe(true));
	for (const o of denied) it(`denies ${JSON.stringify(o)}`, () => expect(isOriginAllowed(o, PORT)).toBe(false));
});
