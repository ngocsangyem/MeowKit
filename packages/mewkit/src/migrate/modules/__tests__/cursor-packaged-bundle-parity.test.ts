// Source -> packaged parity for the Cursor bundle. `scripts/copy-provider-bundles.cjs` (run
// after `tsc` in `build:cli`) copies each authored bundle's DATA verbatim into the compiled
// output so a published install can resolve it at runtime — `tsc` only compiles `.ts`, so the
// manifest/catalog/root/** content under `modules/cursor/` would never reach the compiled
// output on its own. This test proves that copy is content-preserving for the Cursor bundle
// WITHOUT depending on a prior `npm run build:cli` having run (no compiled-output path
// assumptions) — it replicates the copy script's own filter against a throwaway directory and
// asserts every manifest-listed source exists post-copy, byte-identically, with build
// artifacts excluded. No codex-packaged-bundle-parity.test.ts precedent exists yet (the
// copy script's PROVIDERS loop already covers both bundles identically) — this is the first
// packaged-parity test in the suite; a symmetrical codex one can reuse the same shape.
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadCursorBundleManifest, resolveCursorModuleDir } from "../cursor-authored-bundle.js";

const moduleDir = resolveCursorModuleDir();

// Mirrors `isBuildArtifact` in scripts/copy-provider-bundles.cjs exactly — kept as a small
// duplicate (not an import) since that script is a plain Node CLI entrypoint, not a module.
function isBuildArtifact(p: string): boolean {
	const norm = p.split("\\").join("/");
	return /(?:^|\/)__pycache__(?:\/|$)/.test(norm) || norm.endsWith(".pyc");
}

function walkFiles(dir: string, acc: string[] = []): string[] {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) walkFiles(p, acc);
		else acc.push(p);
	}
	return acc;
}

describe("cursor bundle: source -> packaged parity", () => {
	let packaged: string;
	beforeEach(() => {
		const root = mkdtempSync(join(tmpdir(), "cursor-packaged-"));
		packaged = join(root, "cursor");
		// Same call shape as copy-provider-bundles.cjs: recursive copy, filtered.
		cpSync(moduleDir, packaged, { recursive: true, filter: (s) => !isBuildArtifact(s) });
	});
	afterEach(() => rmSync(packaged, { recursive: true, force: true }));

	it("no build artifact (__pycache__, .pyc) survives the packaging copy", () => {
		const leaked = walkFiles(packaged).filter(isBuildArtifact);
		expect(leaked, `build artifacts leaked into the packaged copy: ${leaked.join(", ")}`).toEqual([]);
	});

	it("every manifest-listed source path exists, byte-identical, in the packaged copy", () => {
		const manifest = loadCursorBundleManifest(moduleDir);
		for (const entry of manifest.entries) {
			const src = join(moduleDir, entry.sourcePath);
			const dst = join(packaged, entry.sourcePath);
			expect(existsSync(dst), `packaged copy missing ${entry.sourcePath}`).toBe(true);
			if (statSync(src).isDirectory()) continue; // directory trees checked per-file below
			expect(readFileSync(dst)).toEqual(readFileSync(src));
		}
	});

	it("every core skill's SKILL.md is present and byte-identical in the packaged copy", () => {
		const skillsRoot = "root/.agents/skills";
		const names = readdirSync(join(moduleDir, skillsRoot), { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name);
		expect(names.length).toBeGreaterThan(0);
		for (const name of names) {
			const rel = join(skillsRoot, name, "SKILL.md");
			expect(existsSync(join(packaged, rel)), `${rel} missing from packaged copy`).toBe(true);
			expect(readFileSync(join(packaged, rel))).toEqual(readFileSync(join(moduleDir, rel)));
		}
	});

	it("catalog/skill-packs.json is copied and still resolves the core pack identically", () => {
		const rel = "catalog/skill-packs.json";
		expect(existsSync(join(packaged, rel))).toBe(true);
		expect(JSON.parse(readFileSync(join(packaged, rel), "utf-8"))).toEqual(
			JSON.parse(readFileSync(join(moduleDir, rel), "utf-8")),
		);
	});
});
