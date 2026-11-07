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

/** A project tree holding only the 7 always-on rule files copied from this repo. */
function makeAlwaysOnTree(): string {
	temp = fs.mkdtempSync(path.join(os.tmpdir(), "always-on-"));
	const rules = path.join(temp, ".claude", "rules");
	fs.mkdirSync(rules, { recursive: true });
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
		expect(result.output).toContain(`measured total: ${expected} bytes`);
		expect(expected).toBeLessThanOrEqual(25600);
	});

	it("fails at one byte over the 25600-byte limit", () => {
		const root = makeAlwaysOnTree();
		const rules = path.join(root, ".claude", "rules");
		const current = ALWAYS_ON_RULES.reduce((sum, name) => sum + fs.statSync(path.join(rules, name)).size, 0);
		fs.appendFileSync(path.join(rules, "meowkit-core.md"), "x".repeat(25601 - current));
		const result = run(BUDGET, root);
		expect(result.status).toBe(1);
		expect(result.output).toContain("measured total: 25601 bytes");
	});

	it("exits 2 when the rules directory is unreadable", () => {
		const result = run(BUDGET, path.join(os.tmpdir(), "no-such-meowkit-root"));
		expect(result.status).toBe(2);
		expect(result.output).toContain("cannot read");
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
