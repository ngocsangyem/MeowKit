// The environment-name universe is closed, and the two places that describe the
// config surface cannot drift apart.
//
// One scan script defines the universe; one table classifies it; the read check
// loads that same table as its allowlist. Any other arrangement lets a name be
// allowlisted in one place and unknown in the other, which is how a dead
// variable survives a cleanup whose whole purpose was removing it.
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { observerNames } from "../../packages/mewkit/src/config/observer-names.js";
import { knownKeys } from "../../packages/mewkit/src/config/schema.js";
import { ENV_OVERRIDES } from "../../packages/mewkit/src/config/precedence.js";

const require_ = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");

const TABLE_REL = "env-name-classification.json";
const SCAN_REL = "scripts/scan-env-names.sh";

interface Row {
	name: string;
	class: string;
	key: string;
	reader: string;
}
interface Retained {
	in: string[];
	why: string;
}
interface Table {
	classes: Record<string, string>;
	names: Row[];
	compositionZones: { dir: string; prefix: string }[];
	nonSuffixLiterals: Record<string, string>;
	retainedDropOccurrences: Record<string, Retained | string>;
}

const table = require_(join(REPO_ROOT, TABLE_REL)) as Table;

const { scanReads } = require_(join(REPO_ROOT, "scripts/lib/env-read-scan.cjs")) as {
	scanReads: (root: string, trees: string[], t: Table) => { name: string; file: string }[];
};
const { REPLACED_CLASSES } = require_(join(REPO_ROOT, "scripts/lib/env-table-audit.cjs")) as {
	REPLACED_CLASSES: Set<string>;
};

/** Every environment-name read in the shipped kit, under the scanned trees. */
const reads = () => scanReads(REPO_ROOT, [".claude", join("packages", "mewkit", "src")], table);

/** The universe, from the committed script and nothing else. */
function scan(): string[] {
	const out = execFileSync("sh", [SCAN_REL], { cwd: REPO_ROOT, encoding: "utf8" });
	return out.split("\n").map((s) => s.trim()).filter((s) => s !== "");
}

/** Every scanned file naming `name`, under the same trees and exclusions the scan uses. */
function occurrences(name: string): string[] {
	const result = spawnSync(
		"grep",
		[
			"-rlwE", name,
			".claude", "packages", "scripts", "tests", "docs", ".github", ".meowkit",
			"--binary-files=without-match",
			"--exclude-dir=node_modules", "--exclude-dir=.git", "--exclude-dir=worktrees",
			"--exclude-dir=modules", "--exclude-dir=dist", "--exclude-dir=.next",
			"--exclude=removed-env-names.ts",
		],
		{ cwd: REPO_ROOT, encoding: "utf8" },
	);
	return (result.stdout ?? "").split("\n").map((s) => s.trim()).filter((s) => s !== "");
}

describe("the environment-name universe", () => {
	it("has exactly one table row per name the scan yields", () => {
		const names = scan();
		const rows = table.names.map((r) => r.name);
		expect([...new Set(names)].filter((n) => !rows.includes(n)), "scanned names with no classification row").toEqual([]);
		expect(rows.length).toBe(new Set(rows).size);
	});

	it("holds every live name, and no name whose deletion landed", () => {
		// Two directions, because the two classes of row mean opposite things. A
		// LIVE name is read by code, so a row for one that occurs nowhere is a
		// stale row. A DROPPED name was deleted, so finding one in a scanned tree
		// means the deletion silently did not happen — and it may survive only
		// where the table says it may, which the next case checks file by file.
		//
		// A replaced toggle is neither: the name is a migration record that docs,
		// changelogs and tests may legitimately spell. What must be true of it is
		// that nothing READS it, which is asserted directly below rather than by
		// counting occurrences.
		const scanned = new Set(scan());
		const retained = table.retainedDropOccurrences;
		const live = table.names.filter((r) => !REPLACED_CLASSES.has(r.class)).map((r) => r.name);
		expect(live.filter((n) => !scanned.has(n)), "a name classified as live occurs in no scanned tree").toEqual([]);
		const deleted = table.names
			.filter((r) => r.class === "drop" && !Object.hasOwn(retained, r.name))
			.map((r) => r.name);
		expect(deleted.filter((n) => scanned.has(n)), "a dropped name survives in a scanned tree").toEqual([]);
	});

	it("keeps every retained dropped name only in the files its reason names", () => {
		const retained = Object.entries(table.retainedDropOccurrences).filter(([k]) => k !== "comment");
		expect(retained.length).toBeGreaterThan(0);
		for (const [name, entry] of retained) {
			const allowed = (entry as Retained).in;
			expect(Array.isArray(allowed), `${name} has no allowed-file list`).toBe(true);
			expect((entry as Retained).why, `${name} has no reason`).not.toBe("");
			const files = occurrences(name);
			expect(files.length, `${name} is retained but occurs nowhere`).toBeGreaterThan(0);
			const stray = files.filter((f) => !allowed.some((a) => f.includes(a)));
			expect(stray, `${name} occurs outside the files its retention reason names`).toEqual([]);
		}
	});

	it("gives every row a non-empty class drawn from the declared set", () => {
		const declared = new Set(Object.keys(table.classes));
		for (const row of table.names) {
			expect(row.class, row.name).not.toBe("");
			expect(declared.has(row.class), `${row.name} has class ${row.class}`).toBe(true);
			expect(row.reader, `${row.name} has no reader column`).not.toBe("");
		}
	});

	it("gives a config key to exactly the classes that have one", () => {
		for (const row of table.names) {
			const shouldHaveKey = row.class === "toggle" || row.class === "behavior-override" || row.name === "MEOWKIT_AUTOBUILD_MODE";
			expect(row.key !== "", `${row.name} (${row.class})`).toBe(shouldHaveKey);
		}
	});

	it("treats a prefix fragment as not a name", () => {
		// The scan discards a match ending in `_`: it is an interpolation stem.
		for (const name of scan()) expect(name.endsWith("_"), name).toBe(false);
	});

	it("finds no read of a name the table calls reader-less", () => {
		const dropped = new Set(table.names.filter((r) => r.class === "drop").map((r) => r.name));
		const contradictions = reads().filter((r) => dropped.has(r.name)).map((r) => `${r.name} at ${r.file}`);
		expect(contradictions, "a name classified reader-less is read after all").toEqual([]);
	});

	it("is the same file the read check loads as its allowlist", () => {
		const source = require_("node:fs").readFileSync(join(REPO_ROOT, "scripts/check-env-reads.cjs"), "utf8") as string;
		expect(source).toContain(`TABLE_REL = '${TABLE_REL}'`);
		// Restated as a regex inside the check, the allowlist could disagree with
		// the table. Loaded as data, it cannot.
		expect(source).not.toMatch(/MEOWKIT_[A-Z]/);
	});
});

describe("the two descriptions of the config surface agree", () => {
	it("the hook-side key list equals the schema's key list", () => {
		const hookKeys = require_(join(REPO_ROOT, ".claude/hooks/lib/config-keys.cjs")) as {
			knownKeys: (root: string) => Record<string, unknown>;
		};
		const names = observerNames(REPO_ROOT);
		expect(Object.keys(hookKeys.knownKeys(REPO_ROOT)).sort()).toEqual(Object.keys(knownKeys(names)).sort());
	});

	it("the hook-side and CLI-side environment overrides are the same one key", () => {
		const hookConfig = require_(join(REPO_ROOT, ".claude/hooks/lib/read-config.cjs")) as {
			ENV_OVERRIDES: Record<string, string>;
		};
		expect(hookConfig.ENV_OVERRIDES).toEqual(ENV_OVERRIDES);
		// And the table is where that set is recorded, so the code cannot grow a
		// second supported override without the record growing one too.
		const fromTable = Object.fromEntries(
			table.names.filter((r) => r.class === "behavior-override").map((r) => [r.key, r.name]),
		);
		expect(fromTable).toEqual(ENV_OVERRIDES);
	});

	it("declares no gates or paths property, and no pm.auto", () => {
		const schema = require_(join(REPO_ROOT, "crates/mewkit-core/schemas/config-v1.json")) as {
			properties: Record<string, unknown>;
			additionalProperties: boolean;
		};
		expect(Object.keys(schema.properties)).not.toContain("gates");
		expect(Object.keys(schema.properties)).not.toContain("paths");
		expect(Object.keys(schema.properties)).not.toContain("pm");
		expect(schema.additionalProperties).toBe(false);
		const text = require_("node:fs").readFileSync(join(REPO_ROOT, "crates/mewkit-core/schemas/config-v1.json"), "utf8") as string;
		expect(text).not.toContain("pm.auto");
		expect(text).not.toContain('"auto"');
	});
});
