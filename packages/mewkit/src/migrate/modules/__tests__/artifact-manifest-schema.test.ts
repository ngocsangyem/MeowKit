import { describe, expect, it } from "vitest";
import {
	ArtifactManifestEntrySchema,
	ArtifactManifestSchema,
	parseArtifactManifest,
	serializeArtifactManifest,
	type ArtifactManifest,
} from "../artifact-manifest-schema.js";

const baseEntry = {
	sourcePath: "shared/skills/fix/SKILL.md",
	targetPath: ".claude/skills/fix/SKILL.md",
	provider: "claude-code" as const,
	checksum: "abc123",
	ownership: "managed-replace" as const,
};

describe("ArtifactManifestEntrySchema — fail-closed ownership", () => {
	it("accepts a managed-runtime artifact as managed-replace", () => {
		const r = ArtifactManifestEntrySchema.safeParse({ ...baseEntry, scopeTags: ["managed-runtime"] });
		expect(r.success).toBe(true);
	});

	it("REJECTS a memory-scoped artifact tagged managed-replace", () => {
		const r = ArtifactManifestEntrySchema.safeParse({ ...baseEntry, scopeTags: ["memory"] });
		expect(r.success).toBe(false);
	});

	it("REJECTS state- and user-data-scoped artifacts tagged managed-replace", () => {
		expect(ArtifactManifestEntrySchema.safeParse({ ...baseEntry, scopeTags: ["state"] }).success).toBe(false);
		expect(ArtifactManifestEntrySchema.safeParse({ ...baseEntry, scopeTags: ["user-data"] }).success).toBe(false);
	});

	it("accepts a memory-scoped artifact when it is user-owned-never-touch", () => {
		const r = ArtifactManifestEntrySchema.safeParse({
			...baseEntry,
			ownership: "user-owned-never-touch",
			scopeTags: ["memory"],
		});
		expect(r.success).toBe(true);
	});

	it("defaults mode to 0644 and rejects a non-octal mode", () => {
		const ok = ArtifactManifestEntrySchema.parse({ ...baseEntry, scopeTags: ["managed-runtime"] });
		expect(ok.mode).toBe("0644");
		expect(ArtifactManifestEntrySchema.safeParse({ ...baseEntry, mode: "rwxr", scopeTags: [] }).success).toBe(false);
	});

	it("only accepts the three trimmed providers", () => {
		expect(ArtifactManifestEntrySchema.safeParse({ ...baseEntry, provider: "windsurf", scopeTags: [] }).success).toBe(
			false,
		);
	});
});

describe("ArtifactManifest — parse + deterministic serialize", () => {
	const manifest: ArtifactManifest = {
		version: "1.0",
		provider: "codex",
		generatedFrom: "modules/",
		entries: [
			{
				...baseEntry,
				provider: "codex",
				targetPath: ".codex/hooks.json",
				mode: "0755",
				ownership: "managed-replace",
				mergeBehavior: "replace",
				scopeTags: ["managed-runtime"],
			},
			{
				...baseEntry,
				provider: "codex",
				targetPath: ".codex/AGENTS.md",
				mode: "0644",
				ownership: "managed-replace",
				mergeBehavior: "replace",
				scopeTags: ["managed-runtime"],
			},
		],
	};

	it("round-trips a valid manifest and fails closed on garbage", () => {
		const good = parseArtifactManifest(ArtifactManifestSchema.parse(manifest));
		expect(good.manifest).not.toBeNull();
		const bad = parseArtifactManifest({ version: "1.0", provider: "codex" });
		expect(bad.manifest).toBeNull();
	});

	it("serializes deterministically (entries sorted; two runs byte-identical)", () => {
		const a = serializeArtifactManifest(manifest);
		const b = serializeArtifactManifest({ ...manifest, entries: [...manifest.entries].reverse() });
		expect(a).toBe(b);
		// Sorted by targetPath within the provider.
		expect(a.indexOf(".codex/AGENTS.md")).toBeLessThan(a.indexOf(".codex/hooks.json"));
	});
});
