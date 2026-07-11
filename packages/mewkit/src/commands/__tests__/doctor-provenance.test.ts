// Tests the read-only provenance classifier + reporter behind `doctor provenance --explain`.
// The classifier decides verifiability from metadata alone — no fetching, no relabel — and
// only a trusted (canonical `new`) baseline can attest as-shipped identity.
import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyProvenance, explainProvenance } from "../doctor.js";
import { buildInstallMetadata } from "../../core/install-metadata.js";
import { writeInstallMetadata } from "../../core/install-metadata-writer.js";

describe("classifyProvenance", () => {
	it("verified: kit file matching a TRUSTED baseline", () => {
		expect(classifyProvenance({ owner: "meowkit", checksum: "abc", baseChecksum: "abc" }, true)).toBe("verified");
	});

	it("unknown: kit file matching a RECONSTRUCTED (untrusted) baseline cannot prove as-shipped identity", () => {
		expect(classifyProvenance({ owner: "meowkit", checksum: "abc", baseChecksum: "abc" }, false)).toBe("unknown");
	});

	it("known-modified: meowkit-modified with a known baseline (regardless of trust)", () => {
		expect(classifyProvenance({ owner: "meowkit-modified", checksum: "xyz", baseChecksum: "abc" }, true)).toBe(
			"known-modified",
		);
	});

	it("known-modified: kit-owned file whose disk hash drifted from the baseline", () => {
		expect(classifyProvenance({ owner: "meowkit", checksum: "drifted", baseChecksum: "abc" }, true)).toBe(
			"known-modified",
		);
	});

	it("unknown: no baseline recorded", () => {
		expect(classifyProvenance({ owner: "meowkit", checksum: "abc", baseChecksum: "" }, true)).toBe("unknown");
	});

	it("verified: user-owned file is a user artifact by design", () => {
		expect(classifyProvenance({ owner: "user", checksum: "abc", baseChecksum: "abc" }, true)).toBe("verified");
	});
});

describe("explainProvenance (honesty on non-trusted sources)", () => {
	const dirs: string[] = [];
	afterEach(() => {
		dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
		vi.restoreAllMocks();
	});
	const capture = (): (() => string) => {
		const lines: string[] = [];
		vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void lines.push(a.join(" ")));
		return () => lines.join("\n");
	};
	const makeRoot = (): string => {
		const root = mkdtempSync(join(tmpdir(), "mewkit-prov-"));
		dirs.push(root);
		mkdirSync(join(root, ".claude"), { recursive: true });
		return root;
	};

	it("prints a green all-clear for a pristine canonical (new) install", async () => {
		const root = makeRoot();
		mkdirSync(join(root, ".claude", "rules"), { recursive: true });
		writeFileSync(join(root, ".claude", "rules", "a.md"), "shipped\n");
		await writeInstallMetadata(join(root, ".claude"), buildInstallMetadata(join(root, ".claude"), { version: "2.9.13" }));
		const out = capture();
		explainProvenance(root, true);
		expect(out()).toContain("provable provenance");
	});

	it("does NOT claim all-clear for a version-only (legacy-metadata) install with no file provenance", () => {
		const root = makeRoot();
		writeFileSync(join(root, ".claude", "metadata.json"), JSON.stringify({ version: "2.8.0" }) + "\n");
		const out = capture();
		explainProvenance(root, true);
		const text = out();
		expect(text).toContain("No file-level provenance recorded");
		expect(text).not.toContain("provable provenance");
	});
});
