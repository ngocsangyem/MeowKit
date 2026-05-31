import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { archiveMemory } from "../archive.js";
import { compactMemory } from "../compact.js";
import { findMemoryConflicts } from "../conflicts.js";

let dir: string | null = null;

function tempMemory(): string {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), "mewkit-memory-"));
	const memory = path.join(dir, "memory");
	fs.mkdirSync(memory);
	return memory;
}

function writeStore(memory: string): void {
	fs.writeFileSync(
		path.join(memory, "fixes.json"),
		JSON.stringify(
			{
				version: "2.0.0",
				scope: "fixes",
				consumer: "mk:fix",
				patterns: [
					{ id: "a", pattern: "same", lastSeen: "2020-01-01T00:00:00.000Z" },
					{ id: "a", pattern: "same", lastSeen: "2020-01-01T00:00:00.000Z" },
					{ id: "b", pattern: "same", context: "different" },
				],
			},
			null,
			2,
		),
	);
}

afterEach(() => {
	if (dir) fs.rmSync(dir, { recursive: true, force: true });
	dir = null;
});

describe("memory lifecycle", () => {
	it("compacts exact duplicates in dry-run mode", () => {
		const memory = tempMemory();
		writeStore(memory);
		expect(compactMemory(memory, { dryRun: true })[0]?.removed).toBe(1);
	});

	it("surfaces same-title conflicting entries", () => {
		const memory = tempMemory();
		writeStore(memory);
		expect(findMemoryConflicts(memory)).toHaveLength(1);
	});

	it("archives old entries in dry-run mode", () => {
		const memory = tempMemory();
		writeStore(memory);
		expect(archiveMemory(memory, 90, { dryRun: true })[0]?.archived).toBe(2);
	});
});
