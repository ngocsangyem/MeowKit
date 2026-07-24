import { describe, expect, it } from "vitest";
import { classifyMemoryFile } from "../memory-classification-rules.js";

describe("classifyMemoryFile", () => {
	it("routes curated JSON stores to memory/ and tags the store spec", () => {
		const c = classifyMemoryFile("fixes.json");
		expect(c.targetClass).toBe("memory");
		expect(c.targetRelPath).toBe("memory/fixes.json");
		expect(c.curatedStore?.scope).toBe("fixes");
	});

	it("routes curated human notes to memory/", () => {
		expect(classifyMemoryFile("architecture-decisions.md").targetRelPath).toBe("memory/architecture-decisions.md");
		expect(classifyMemoryFile("quick-notes.md").targetClass).toBe("memory");
	});

	it("routes generated views under memory/views/", () => {
		expect(classifyMemoryFile("views/fixes.md").targetRelPath).toBe("memory/views/fixes.md");
	});

	it("routes logs to telemetry/", () => {
		expect(classifyMemoryFile("cost-log.json").targetClass).toBe("telemetry");
		expect(classifyMemoryFile("trace-log.jsonl").targetClass).toBe("telemetry");
		expect(classifyMemoryFile("security-log.md").targetClass).toBe("telemetry");
		expect(classifyMemoryFile("skill-usage-2026.json").targetClass).toBe("telemetry");
	});

	it("routes SQLite indexes to cache/", () => {
		expect(classifyMemoryFile("wiki-index.db").targetRelPath).toBe("cache/wiki-index.db");
	});

	it("routes state markers to state/", () => {
		expect(classifyMemoryFile("last-model-id.txt").targetRelPath).toBe("state/last-model-id.txt");
		expect(classifyMemoryFile("session-active.flag").targetClass).toBe("state");
	});

	it("retains .gitkeep in place (no target)", () => {
		const c = classifyMemoryFile(".gitkeep");
		expect(c.targetClass).toBe("retain");
		expect(c.targetRelPath).toBe("");
	});

	it("sends unknown files to the lossless memory/legacy/ catch-all, preserving relPath", () => {
		expect(classifyMemoryFile("mystery.dat").targetRelPath).toBe("memory/legacy/mystery.dat");
		expect(classifyMemoryFile("notes/scratch.txt").targetRelPath).toBe("memory/legacy/notes/scratch.txt");
	});

	it("does NOT treat security-notes.md (curated) as a log", () => {
		expect(classifyMemoryFile("security-notes.md").targetClass).toBe("memory");
	});
});
