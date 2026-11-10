// The always-on budget check enforces two ceilings, and both must bite.
//
// The probe that matters is the one a combined total would hide: rules ABOVE their own ceiling
// while the always-listed total is still comfortably under its ceiling. If only the total were
// enforced, that tree would pass — and shortening an always-on safety rule would become a way to
// buy room for metadata, which is the exact trade the rules ceiling exists to forbid. So the
// assertion is not "the limits appear in the source"; it is "this tree exits non-zero".
//
// Each case builds a minimal scratch tree rather than copying the repository: a copy of a tree
// that is already over the total cannot distinguish the two ceilings, and a synthetic tree makes
// the measured set small enough to reason about by hand.
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = path.join(REPO_ROOT, "scripts", "check-always-on-budget.cjs");

interface TreeOptions {
	rulesBytes: number;
	skills: number;
	skillDescriptionBytes: number;
}

/** A tree with the shape the check reads: a rules dir, a pack manifest and some shipped skills. */
function buildTree(options: TreeOptions): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "always-on-budget-"));
	fs.mkdirSync(path.join(root, ".claude", "rules"), { recursive: true });
	fs.mkdirSync(path.join(root, ".meowkit"), { recursive: true });
	fs.writeFileSync(
		path.join(root, ".meowkit", "pack-manifest.json"),
		JSON.stringify({ base: { exclude: [] } }),
	);
	fs.writeFileSync(path.join(root, ".claude", "rules", "one.md"), "r".repeat(options.rulesBytes));
	for (let i = 0; i < options.skills; i += 1) {
		const dir = path.join(root, ".claude", "skills", `probe-${i}`);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(
			path.join(dir, "SKILL.md"),
			[
				"---",
				`name: mk:probe-${i}`,
				`description: ${"d".repeat(options.skillDescriptionBytes)}`,
				"when_to_use: when probing",
				"---",
				"",
				"body",
				"",
			].join("\n"),
		);
	}
	// The ship set counts only git-tracked files, so the tree is a repo with everything staged.
	spawnSync("git", ["init", "-q"], { cwd: root });
	spawnSync("git", ["add", "-A"], { cwd: root });
	return root;
}

function run(root: string): { status: number; out: string } {
	const result = spawnSync(process.execPath, [CHECK, root], { encoding: "utf8" });
	return { status: result.status ?? -1, out: `${result.stdout}${result.stderr}` };
}

describe("always-on budget ceilings", () => {
	it("fails when the rules alone are over their ceiling even though the total is far under", () => {
		// 30000 B of rules: over the 25600 rules ceiling, and the whole tree is nowhere near 70000.
		const root = buildTree({ rulesBytes: 30000, skills: 2, skillDescriptionBytes: 50 });
		const { status, out } = run(root);
		expect(out).toContain("always-listed 30");
		expect(out).toMatch(/always-on rules are \d+ bytes over the 25600-byte budget/);
		expect(status).not.toBe(0);
	});

	it("fails and names the offending block when metadata pushes the total over", () => {
		const root = buildTree({ rulesBytes: 1000, skills: 40, skillDescriptionBytes: 2000 });
		const { status, out } = run(root);
		expect(status).toBe(1);
		expect(out).toMatch(/are \d+ bytes over the 70000-byte budget/);
		// The offending file, its byte count and the overage must all be readable from the output.
		expect(out).toContain("largest block: .claude/skills/probe-");
		expect(out).toMatch(/largest block: .*, \d+ B/);
	});

	it("passes when both sets are under their own ceiling", () => {
		const root = buildTree({ rulesBytes: 20000, skills: 10, skillDescriptionBytes: 200 });
		const { status, out } = run(root);
		expect(status).toBe(0);
		expect(out).toContain("of rules headroom");
		expect(out).toContain("of always-listed headroom");
	});

	it("still exits 2 when the rules directory is unreadable", () => {
		const root = buildTree({ rulesBytes: 100, skills: 1, skillDescriptionBytes: 10 });
		fs.rmSync(path.join(root, ".claude", "rules"), { recursive: true });
		expect(run(root).status).toBe(2);
	});

	it("reports both ceilings, all three subtotals and a descending per-item list", () => {
		const root = buildTree({ rulesBytes: 1000, skills: 3, skillDescriptionBytes: 100 });
		const { out } = run(root);
		expect(out).toContain("limit 25600");
		expect(out).toContain("limit 70000");
		expect(out).toMatch(/rules\s+1000/);
		expect(out).toMatch(/skills\s+\d+/);
		expect(out).toMatch(/agents\s+0/);
		expect(out).toContain("reference per-item figures (NOT enforced");
		expect(out).toContain("descending by size");
		// Descending really descends: the first listed block is the largest measured one.
		const listed = [...out.matchAll(/^\s+(\d+)\t(?:skill|agent)/gm)].map((m) => Number(m[1]));
		expect(listed.length).toBeGreaterThan(1);
		expect([...listed].sort((a, b) => b - a)).toEqual(listed);
	});
});
