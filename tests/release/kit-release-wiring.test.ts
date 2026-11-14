// The ship set has exactly one source, read by the release zip builder. Kit
// releases are cut by scripts/release.sh with a zip and checksums.txt.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

describe("kit ship set", () => {
	it("gives the ship set one source, read by the zip builder", () => {
		const shared = readFileSync(join(REPO, "scripts", "kit-ship-set.cjs"), "utf8");
		expect(shared).toMatch(/base\.exclude/);
		const source = readFileSync(join(REPO, "scripts", "prepare-release-assets.cjs"), "utf8");
		expect(source).toMatch(/require\("\.\/kit-ship-set\.cjs"\)/);
		// No second list: the builder does not spell out its own exclusions.
		expect(source).not.toMatch(/"-x",\s*"/);
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
