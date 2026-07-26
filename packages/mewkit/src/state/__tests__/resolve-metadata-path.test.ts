// The metadata resolver decides which baseline `smart-update` compares a file against. If it
// returns the wrong path, every file looks unmodified and an upgrade overwrites user edits
// without a word. Five project shapes, with the write target and the read target asserted
// separately — the same split that caught the `dbPath` bug during the state-root move.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	legacyMetadataPath,
	metadataLockPath,
	metadataWritePath,
	resolveMetadataPath,
	usingLegacyMetadata,
} from "../resolve-metadata-path.js";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

type Shape = "fresh" | "legacy" | "canonical" | "both" | "state-root-only";

function makeRoot(shape: Shape): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-metadata-"));
	roots.push(root);
	if (shape === "legacy" || shape === "both") {
		mkdirSync(join(root, ".claude"), { recursive: true });
		writeFileSync(join(root, ".claude", "metadata.json"), "{}");
	}
	if (shape === "canonical" || shape === "both") {
		mkdirSync(join(root, ".meowkit"), { recursive: true });
		writeFileSync(join(root, ".meowkit", "metadata.json"), "{}");
	}
	if (shape === "state-root-only") {
		// `.meowkit/` exists for other state (memory, cache) but holds no metadata yet. This is
		// the shape a project takes between the config move and this one, and the resolver must
		// not read the directory's existence as the file's existence.
		mkdirSync(join(root, ".meowkit", "memory"), { recursive: true });
	}
	return root;
}

describe("resolveMetadataPath", () => {
	it("always writes to `.meowkit/metadata.json`, whatever the project already has", () => {
		for (const shape of ["fresh", "legacy", "canonical", "both", "state-root-only"] as const) {
			const root = makeRoot(shape);
			expect(metadataWritePath(root)).toBe(join(root, ".meowkit", "metadata.json"));
		}
	});

	it("keeps the lock beside the file it guards", () => {
		const root = makeRoot("fresh");
		expect(metadataLockPath(root)).toBe(join(root, ".meowkit", ".metadata.lock"));
	});

	it("reads the canonical baseline when it exists", () => {
		const root = makeRoot("canonical");
		expect(resolveMetadataPath(root)).toBe(join(root, ".meowkit", "metadata.json"));
		expect(usingLegacyMetadata(root)).toBe(false);
	});

	it("falls back to a pre-move install, so upgrading the CLI does not lose its baseline", () => {
		const root = makeRoot("legacy");
		expect(resolveMetadataPath(root)).toBe(join(root, ".claude", "metadata.json"));
		expect(usingLegacyMetadata(root)).toBe(true);
		expect(legacyMetadataPath(root)).toBe(join(root, ".claude", "metadata.json"));
	});

	it("prefers the canonical baseline once both exist, so a migrated project stops reading the old one", () => {
		const root = makeRoot("both");
		expect(resolveMetadataPath(root)).toBe(join(root, ".meowkit", "metadata.json"));
		expect(usingLegacyMetadata(root)).toBe(false);
	});

	it("does not mistake an existing `.meowkit/` for an existing baseline", () => {
		const root = makeRoot("state-root-only");
		expect(resolveMetadataPath(root)).toBe(join(root, ".meowkit", "metadata.json"));
		expect(usingLegacyMetadata(root)).toBe(false);
	});

	it("reports the path it would create when neither exists, never a legacy path", () => {
		const root = makeRoot("fresh");
		expect(resolveMetadataPath(root)).toBe(join(root, ".meowkit", "metadata.json"));
		expect(usingLegacyMetadata(root)).toBe(false);
	});
});
