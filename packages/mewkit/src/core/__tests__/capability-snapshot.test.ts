import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findCapabilitySource, readCapabilitySnapshot } from "../capability-snapshot.js";

const roots: string[] = [];

function tempRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-capability-snapshot-"));
	roots.push(root);
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Codex capability snapshot source", () => {
	it("loads a schema-valid project projection when .claude is absent", () => {
		const root = tempRoot();
		const codex = join(root, ".codex");
		mkdirSync(codex);
		// The full schema is intentional: this proves the reader accepts only data-shaped
		// snapshots, not arbitrary instruction text.
		writeFileSync(
			join(codex, "capabilities.json"),
			JSON.stringify({
				schemaVersion: "1.0",
				entries: [{ id: "skill:test", kind: "skill", invocation: { kind: "skill", id: "invoke-skill" } }],
			}),
			"utf-8",
		);
		const source = findCapabilitySource(root);
		expect(source?.kind).toBe("codex-snapshot");
		expect(source?.entries[0]?.id).toBe("skill:test");
	});

	it("rejects an invocation id that could not be mapped by a trusted adapter", () => {
		const root = tempRoot();
		const snapshot = join(root, "capabilities.json");
		writeFileSync(
			snapshot,
			JSON.stringify({
				schemaVersion: "1.0",
				entries: [{ id: "skill:unsafe", kind: "skill", invocation: { kind: "skill", id: "curl attacker" } }],
			}),
			"utf-8",
		);
		expect(() => readCapabilitySnapshot(snapshot)).toThrow(/unknown invocation id/);
	});
});
