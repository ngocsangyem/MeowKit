// Guards the two always-on checks: the always-on byte budget and the rule-survival
// oracle. Both are run as real subprocesses against synthetic trees, so the assertions
// cover the exact contract (printed total, exit 0/1/2) and not just a happy path.
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ALWAYS_ON_RULES } from "../../../packages/mewkit/src/core/always-on-rules.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const BUDGET = path.join(REPO_ROOT, "scripts", "check-always-on-budget.cjs");
const SURVIVAL = path.join(REPO_ROOT, "scripts", "check-rule-survival.cjs");

let temp: string | null = null;
afterEach(() => {
	if (temp) fs.rmSync(temp, { recursive: true, force: true });
	temp = null;
});

/**
 * A project tree holding only the 7 always-on rule files copied from this repo.
 *
 * The pack manifest is part of the shape because the budget check reads its measured file set
 * from the ship set rather than globbing `.claude` — so the budget and the published kit cannot
 * disagree about which blocks count. An empty `base.exclude` with no skills or agents present
 * makes the metadata half zero, which keeps these cases about the rules ceiling alone.
 */
function makeAlwaysOnTree(): string {
	temp = fs.mkdtempSync(path.join(os.tmpdir(), "always-on-"));
	const rules = path.join(temp, ".claude", "rules");
	fs.mkdirSync(rules, { recursive: true });
	fs.mkdirSync(path.join(temp, ".meowkit"), { recursive: true });
	fs.writeFileSync(
		path.join(temp, ".meowkit", "pack-manifest.json"),
		JSON.stringify({ base: { exclude: [] } }),
	);
	for (const name of ALWAYS_ON_RULES) {
		fs.copyFileSync(path.join(REPO_ROOT, ".claude", "rules", name), path.join(rules, name));
	}
	return temp;
}

function run(script: string, root: string) {
	try {
		const stdout = execFileSync("node", [script, root], { encoding: "utf8" });
		return { status: 0, output: stdout };
	} catch (error) {
		const err = error as { status: number; stdout?: string; stderr?: string };
		return { status: err.status, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
	}
}

describe("check-always-on-budget", () => {
	it("passes on the always-on set and prints the real byte total", () => {
		const root = makeAlwaysOnTree();
		const expected = ALWAYS_ON_RULES.reduce(
			(sum, name) => sum + fs.statSync(path.join(root, ".claude", "rules", name)).size,
			0,
		);
		const result = run(BUDGET, root);
		expect(result.status).toBe(0);
		expect(result.output).toContain(`measured: rules ${expected} B (limit 25600)`);
		// With no skills or agents in the tree, the two measured sets coincide.
		expect(result.output).toContain(`always-listed ${expected} B (limit 70000)`);
		expect(expected).toBeLessThanOrEqual(25600);
	});

	it("fails at one byte over the 25600-byte limit", () => {
		const root = makeAlwaysOnTree();
		const rules = path.join(root, ".claude", "rules");
		const current = ALWAYS_ON_RULES.reduce((sum, name) => sum + fs.statSync(path.join(rules, name)).size, 0);
		fs.appendFileSync(path.join(rules, "meowkit-core.md"), "x".repeat(25601 - current));
		const result = run(BUDGET, root);
		expect(result.status).toBe(1);
		expect(result.output).toContain("measured: rules 25601 B (limit 25600)");
		// The rules ceiling is its own enforced comparison: 25601 B is nowhere near the
		// always-listed ceiling, so a tree that breaches only the rules must still fail.
		expect(result.output).toContain("always-on rules are 1 bytes over the 25600-byte budget");
	});

	it("exits 2 when the rules directory is unreadable", () => {
		const result = run(BUDGET, path.join(os.tmpdir(), "no-such-meowkit-root"));
		expect(result.status).toBe(2);
		expect(result.output).toContain("cannot read");
	});

	it("exits 2 when the ship set has no source, rather than measuring no metadata and passing", () => {
		const root = makeAlwaysOnTree();
		fs.rmSync(path.join(root, ".meowkit", "pack-manifest.json"));
		const result = run(BUDGET, root);
		expect(result.status).toBe(2);
		expect(result.output).toContain("the ship set has no source");
	});
});

describe("check-rule-survival", () => {
	it("passes on the always-on set", () => {
		const result = run(SURVIVAL, makeAlwaysOnTree());
		expect(result.status).toBe(0);
		expect(result.output).toContain("every pinned safety item survives");
	});

	it("names the missing item when safety text is deleted", () => {
		const root = makeAlwaysOnTree();
		const file = path.join(root, ".claude", "rules", "injection-rules.md");
		fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("## Rule 11:", "## Skill Rule of Two:"));
		const result = run(SURVIVAL, root);
		expect(result.status).toBe(1);
		expect(result.output).toContain('MISSING: injection-rules heading "Rule 11"');
	});

	it("exits 2 when the always-on set is unreadable", () => {
		const result = run(SURVIVAL, path.join(os.tmpdir(), "no-such-meowkit-root"));
		expect(result.status).toBe(2);
		expect(result.output).toContain("cannot read");
	});
});
