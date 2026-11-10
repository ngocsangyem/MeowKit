// The ship set has exactly one source that both archive builders read, and the
// dormant artifact build still refuses a version that is not one.
//
// No release workflow runs the artifact build any more: kit releases are cut by
// scripts/release.sh with a zip and checksums.txt, and the signing path stays in
// the tree unused until a trusted key exists.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The kit's version source, so the fallback and the build script's rejection are
// checked against the same rule rather than against two copies of it.
import { KIT_VERSION_PATTERN } from "../../../../../scripts/kit-version.cjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..", "..");

describe("kit ship set", () => {
	it("gives the ship set one source, read by both archive builders", () => {
		const shared = readFileSync(join(REPO, "scripts", "kit-ship-set.cjs"), "utf8");
		expect(shared).toMatch(/base\.exclude/);
		for (const builder of ["prepare-release-assets.cjs", "build-kit-artifact.cjs"]) {
			const source = readFileSync(join(REPO, "scripts", builder), "utf8");
			expect(source).toMatch(/require\("\.\/kit-ship-set\.cjs"\)/);
			// No second list: neither builder spells out its own exclusions.
			expect(source).not.toMatch(/"-x",\s*"/);
		}
	});

	it("keeps every exclusion pattern the zip build carried, and adds the ship-set ones", () => {
		const manifest = JSON.parse(readFileSync(join(REPO, ".meowkit", "pack-manifest.json"), "utf8")) as {
			base: { exclude: string[] };
		};
		const carriedOver = [
			".claude/session-state/*",
			".claude/memory/*",
			".claude/logs/*",
			".claude/skills/.venv/*",
			".claude/worktrees/*",
			".claude/metadata.json",
			".claude/.env",
			".meowkit/.env",
			".meowkit/memory/*",
			".meowkit/cache/*",
			".meowkit/telemetry/*",
			".meowkit/metadata.json",
			"*.pyc",
			"__pycache__/*",
		];
		expect(carriedOver).toHaveLength(14);
		for (const pattern of carriedOver) expect(manifest.base.exclude).toContain(pattern);
		// The zip build's three `tasks/*` patterns are deliberately gone with the
		// root: a pattern over a path no archive walks withholds nothing.
		expect(manifest.base.exclude.filter((pattern) => pattern.startsWith("tasks/"))).toEqual([]);
	});
});

describe("the dormant artifact build's version guard", () => {
	it("still rejects the branch names the old fallback produced", () => {
		// A branch name is not a version; the build script must stop at its guard.
		for (const branch of ["main", "dev"]) {
			expect(KIT_VERSION_PATTERN.test(branch)).toBe(false);
			expect(buildScriptRejects(branch)).toBe(true);
		}
	});
});

/** Whether the real build script refuses `version` at its version guard. */
function buildScriptRejects(version: string): boolean {
	try {
		execFileSync(process.execPath, [join(REPO, "scripts", "build-kit-artifact.cjs"), version], {
			cwd: REPO,
			encoding: "utf8",
			// No signing key, so a version the guard ACCEPTS fails later, at the key.
			// That is the discriminator: the message says which guard stopped it.
			env: { ...process.env, MEOWKIT_KIT_SIGNING_KEY: "" },
			stdio: "pipe",
		});
		return false;
	} catch (error) {
		const output = String((error as { stderr?: Buffer }).stderr ?? "");
		return output.includes("Invalid version format");
	}
}
