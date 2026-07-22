import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { meowkitStatePaths } from "../meowkit-state-paths.js";

// Pure path builders — no filesystem side effects. Taxonomy is fixed:
// memory/ telemetry/ state/ cache/ migrations/. The migration lock lives under
// state/ (Validation Session 1: relocated from `.mewkit/.lock`).

describe("meowkitStatePaths", () => {
	const meowkit = join("/project", ".meowkit");
	const p = meowkitStatePaths(meowkit);

	it("exposes the five-store taxonomy under the .meowkit base", () => {
		expect(p.base).toBe(meowkit);
		expect(p.memory).toBe(join(meowkit, "memory"));
		expect(p.telemetry).toBe(join(meowkit, "telemetry"));
		expect(p.state).toBe(join(meowkit, "state"));
		expect(p.cache).toBe(join(meowkit, "cache"));
		expect(p.migrations).toBe(join(meowkit, "migrations"));
	});

	it("locates the migration lock under state/ (single authority path)", () => {
		expect(p.migrateLock).toBe(join(meowkit, "state", "migrate.lock"));
	});

	it("locates per-store locks under state/locks/", () => {
		expect(p.storeLocksDir).toBe(join(meowkit, "state", "locks"));
	});
});
