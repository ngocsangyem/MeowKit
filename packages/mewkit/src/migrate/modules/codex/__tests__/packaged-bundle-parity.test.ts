// Dist-parity guard for the authored Codex bundle. `scripts/copy-codex-bundle.cjs` mirrors
// `src/migrate/modules/codex/` into `dist/` (the only path in package.json `files`), so a
// published `init --target codex` reads the copied tree. This test closes the verified gap
// that the copy script had no test: it (1) proves every manifest entry + catalog/ + compliance/
// artifact exists in the source bundle, and (2) proves the recursive copy reproduces the whole
// tree with zero drops — the two ways a packaged install could ship an incomplete bundle. It is
// build-independent: it performs the same recursive copy the script does, so it never depends on
// a prior `npm run build`.
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const bundleDir = join(here, ".."); // src/migrate/modules/codex
const pkgRoot = join(here, "..", "..", "..", "..", ".."); // packages/mewkit

interface ManifestEntry {
	sourcePath: string;
	targetPath: string;
}

function readManifest(): { entries: ManifestEntry[] } {
	return JSON.parse(readFileSync(join(bundleDir, "manifest.json"), "utf-8"));
}

/** Every file path (relative, POSIX) under a directory tree, sorted. */
function walk(root: string): string[] {
	const out: string[] = [];
	const rec = (dir: string): void => {
		for (const d of readdirSync(dir, { withFileTypes: true })) {
			const abs = join(dir, d.name);
			if (d.isDirectory()) rec(abs);
			else out.push(relative(root, abs).split("\\").join("/"));
		}
	};
	rec(root);
	return out.sort();
}

describe("codex bundle manifest integrity", () => {
	it("every manifest sourcePath resolves to a real file or directory in the bundle", () => {
		const { entries } = readManifest();
		expect(entries.length).toBeGreaterThan(0);
		const missing = entries.filter((e) => !existsSync(join(bundleDir, e.sourcePath)));
		expect(missing.map((e) => e.sourcePath)).toEqual([]);
	});

	it("ships the catalog and compliance evidence the bundle depends on", () => {
		expect(existsSync(join(bundleDir, "catalog", "skill-packs.json"))).toBe(true);
		const compliance = join(bundleDir, "compliance");
		expect(existsSync(compliance)).toBe(true);
		// At least the version matrix must ride along (the compat lane's evidence anchor).
		expect(existsSync(join(compliance, "minimum-version-matrix.json"))).toBe(true);
	});

	it("catalog/skill-packs.json parses and references the default `core` pack", () => {
		const raw = readFileSync(join(bundleDir, "catalog", "skill-packs.json"), "utf-8");
		expect(() => JSON.parse(raw)).not.toThrow();
		expect(raw).toContain("core"); // the default pack must be defined
	});
});

describe("codex bundle dist-copy parity", () => {
	let dest: string;
	beforeEach(() => {
		dest = mkdtempSync(join(tmpdir(), "codex-bundle-copy-"));
	});
	afterEach(() => {
		rmSync(dest, { recursive: true, force: true });
	});

	it("the recursive copy reproduces the entire source tree with zero drops", () => {
		// Mirror exactly what scripts/copy-codex-bundle.cjs does.
		cpSync(bundleDir, dest, { recursive: true });
		const srcFiles = walk(bundleDir);
		const destFiles = walk(dest);
		expect(destFiles).toEqual(srcFiles);
		expect(srcFiles.length).toBeGreaterThan(50); // sanity: the bundle is substantial
	});

	it("every manifest entry is present in the copied tree, preserving exec bits on hook wrappers", () => {
		cpSync(bundleDir, dest, { recursive: true });
		const { entries } = readManifest();
		for (const e of entries) {
			expect(existsSync(join(dest, e.sourcePath)), `${e.sourcePath} dropped by copy`).toBe(true);
		}
		// Hook wrappers must stay executable after copy (they run as Codex PreToolUse hooks).
		// POSIX only: Windows/NTFS has no exec bit in statSync().mode, so this would false-fail
		// on the windows-latest job that also runs this file — skip the bit check there.
		const hook = join(dest, "root", ".codex", "hooks", "gate-enforcement.cjs");
		if (existsSync(hook) && process.platform !== "win32") {
			expect((statSync(hook).mode & 0o111) !== 0).toBe(true);
		}
	});
});

describe("package publishes the dist bundle", () => {
	it("package.json `files` includes dist (the runtime bundle path)", () => {
		const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf-8"));
		expect(pkg.files).toContain("dist");
	});
});
