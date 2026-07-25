// Version-support contract for the Cursor native hook bundle. Two things are
// under test: (1) the capabilities.ts floor behaves per the warn-and-degrade
// contract (mirrors codex-version-support.test.ts), and (2) the authored
// minimum-version-matrix.json stays consistent with capabilities.ts and with
// the authored hooks.json event set — so a floor bump or a hooks.json edit
// that forgets to update the matrix fails a test instead of drifting silently.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	CURSOR_MIN_SUPPORTED_VERSION,
	detectCursorVersion,
	isCursorVersionSupported,
} from "../../providers/cursor/capabilities.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CURSOR_MODULE_DIR = join(HERE, "..", "..", "modules", "cursor");

describe("isCursorVersionSupported", () => {
	it("targets 3.11.0 as the minimum supported hook-bundle floor", () => {
		expect(CURSOR_MIN_SUPPORTED_VERSION).toBe("3.11.0");
	});

	it("accepts versions at or above the minimum", () => {
		expect(isCursorVersionSupported("3.11.0")).toBe(true);
		expect(isCursorVersionSupported("3.13.10")).toBe(true);
		expect(isCursorVersionSupported("4.0.0")).toBe(true);
	});

	it("rejects versions below the minimum", () => {
		expect(isCursorVersionSupported("3.10.9")).toBe(false);
		expect(isCursorVersionSupported("2.5.0")).toBe(false);
	});

	it("rejects unparseable version strings (fail-closed)", () => {
		expect(isCursorVersionSupported("not-a-version")).toBe(false);
		expect(isCursorVersionSupported("")).toBe(false);
	});
});

// Warn-and-degrade detection: undetectable version is null, never treated as
// below-minimum (a project without the `cursor` CLI shim on PATH must not nag).
describe("detectCursorVersion", () => {
	it("returns null under a compat override so callers do not warn on an undetectable version", async () => {
		const prev = process.env.MEWKIT_CURSOR_COMPAT;
		process.env.MEWKIT_CURSOR_COMPAT = "strict";
		try {
			expect(await detectCursorVersion()).toBeNull();
		} finally {
			if (prev === undefined) delete process.env.MEWKIT_CURSOR_COMPAT;
			else process.env.MEWKIT_CURSOR_COMPAT = prev;
		}
	});
});

interface HooksJson {
	version?: number;
	hooks?: Record<string, unknown>;
}
interface VersionMatrix {
	ide: { operationalFloor: string };
	hookEvents: Array<{ event: string }>;
	deferredV1: string[];
}

describe("minimum-version-matrix.json consistency", () => {
	const matrix: VersionMatrix = JSON.parse(
		readFileSync(join(CURSOR_MODULE_DIR, "compliance", "minimum-version-matrix.json"), "utf-8"),
	);
	const hooksJson: HooksJson = JSON.parse(
		readFileSync(join(CURSOR_MODULE_DIR, "root", ".cursor", "hooks.json"), "utf-8"),
	);

	it("matrix.ide.operationalFloor matches CURSOR_MIN_SUPPORTED_VERSION", () => {
		expect(matrix.ide.operationalFloor).toBe(CURSOR_MIN_SUPPORTED_VERSION);
	});

	it("every event configured in hooks.json has a matrix row (or is explicitly deferred)", () => {
		const matrixEvents = new Set(matrix.hookEvents.map((e) => e.event));
		for (const event of Object.keys(hooksJson.hooks ?? {})) {
			const documented = matrixEvents.has(event) || matrix.deferredV1.includes(event);
			expect(documented, `hooks.json event '${event}' is missing from minimum-version-matrix.json`).toBe(true);
		}
	});

	it("every matrix hookEvent row is actually configured in hooks.json", () => {
		const configuredEvents = new Set(Object.keys(hooksJson.hooks ?? {}));
		for (const row of matrix.hookEvents) {
			expect(configuredEvents.has(row.event), `matrix row '${row.event}' has no corresponding hooks.json entry`).toBe(
				true,
			);
		}
	});

	it("hooks.json declares schema version 1", () => {
		expect(hooksJson.version).toBe(1);
	});
});
