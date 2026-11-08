// The verb validator fails on a planted stale verb and passes on the tree.
//
// A check that only ever passes proves nothing about what it would catch, so the
// negative case is planted rather than argued.
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const REPO_ROOT = join(import.meta.dirname, "..", "..");
const PLANT = join(REPO_ROOT, ".claude", "skills", "careful", "references", "planted-verb.md");

interface Checker {
	findUnresolved: () => { findings: { file: string; line: number; verb: string }[]; calls: number; verbs: string[] };
}

const checker = require_(join(REPO_ROOT, "scripts", "check-kit-verbs.cjs")) as Checker;

describe("kit verb resolution", () => {
	afterEach(() => rmSync(PLANT, { force: true }));

	it("every mewkit verb the shipped kit names resolves", () => {
		const { findings, calls, verbs } = checker.findUnresolved();
		expect(findings).toEqual([]);
		expect(calls).toBeGreaterThan(100);
		// The two removal/recovery verbs, and no alias for either: a destructive
		// verb reachable under a second name is a verb a reader cannot grep for.
		expect(verbs).toContain("uninstall");
		expect(verbs).toContain("backups");
		expect(verbs).not.toContain("audit");
	});

	it("fails on a planted stale verb", () => {
		writeFileSync(PLANT, "Run `mewkit frobnicate --now` to continue.\n", "utf8");
		const { findings } = checker.findUnresolved();
		expect(findings.map((f) => f.verb)).toContain("frobnicate");
	});
});
