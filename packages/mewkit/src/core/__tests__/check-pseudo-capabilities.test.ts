import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	findPseudoCapabilities,
	formatPseudoCapabilityError,
	scanForPseudoCapabilities,
} from "../check-pseudo-capabilities.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function treeWith(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "pseudo-cap-"));
	tempDirs.push(root);
	for (const [rel, body] of Object.entries(files)) {
		const abs = join(root, rel);
		await mkdir(join(abs, ".."), { recursive: true });
		await writeFile(abs, body, "utf-8");
	}
	return root;
}

describe("scanForPseudoCapabilities", () => {
	// The real defect shape: a template placeholder that shipped unsubstituted.
	it.each([
		["use `ask_user capability` to confirm"],
		["Utilize `manage_plan capability` during implementation"],
		["Pattern: `delegate_agent capability(subagent_type=...)`"],
		["run_shell capability is available"],
		["Use the MANAGE_PLAN CAPABILITY here"], // case-insensitive
	])("flags %s", async (line) => {
		const root = await treeWith({ "skills/x/SKILL.md": line });
		expect(scanForPseudoCapabilities(root, "skills/x/SKILL.md")).toHaveLength(1);
	});

	it("reports file and line", async () => {
		const root = await treeWith({
			"skills/x/SKILL.md": ["# Skill", "", "use `manage_plan capability` now"].join("\n"),
		});
		const [found] = scanForPseudoCapabilities(root, "skills/x/SKILL.md");
		expect(found).toEqual({ file: "skills/x/SKILL.md", line: 3, found: "manage_plan capability" });
	});

	// Legitimate prose that must NOT trip: the operation named on its own, or the
	// word "capability" used normally. Flagging these would make the gate useless.
	it.each([
		["The adapter maps ask_user to AskUserQuestion."],
		["This capability is supported on claude-code."],
		["delegate_agent flows through the orchestrator boundary."],
		["Every capability entry declares its support levels."],
		["manage_plan reads plan state."],
	])("does not flag %s", async (line) => {
		const root = await treeWith({ "skills/x/SKILL.md": line });
		expect(scanForPseudoCapabilities(root, "skills/x/SKILL.md")).toEqual([]);
	});

	it("honors the suppression marker for prose that must quote the anti-pattern", async () => {
		const root = await treeWith({
			"rules/x.md": "Never write `manage_plan capability` <!-- lint-allow-pseudo-capability -->",
		});
		expect(scanForPseudoCapabilities(root, "rules/x.md")).toEqual([]);
	});

	it("finds aliases across a nested tree", async () => {
		const root = await treeWith({
			"skills/a/SKILL.md": "clean prose",
			"skills/b/references/deep.md": "use `run_shell capability`",
		});
		const found = findPseudoCapabilities(root);
		expect(found).toHaveLength(1);
		expect(found[0].file).toContain("deep.md");
	});
});

describe("findPseudoCapabilities + formatPseudoCapabilityError", () => {
	it("returns no findings for a clean tree", async () => {
		const root = await treeWith({
			"agents/dev.md": "---\nname: developer\n---\n\nDeveloper agent.\n",
			"skills/demo/SKILL.md": "---\nname: mk:demo\n---\n\nA clean skill.\n",
		});
		expect(findPseudoCapabilities(root)).toEqual([]);
	});

	// Mutation test — the success criterion: seeding the defect must surface a finding
	// whose formatted error names the offending file:line. This is the same check a
	// build step would run before shipping a payload built from this tree.
	it("finds a seeded alias with file:line and a formatted error", async () => {
		const root = await treeWith({
			"skills/demo/references/how-to.md": "# How to\n\nFirst, use `manage_plan capability` to record the plan.\n",
		});
		const findings = findPseudoCapabilities(root);
		expect(findings).toHaveLength(1);
		expect(findings[0].file).toContain("how-to.md");
		expect(findings[0].line).toBe(3);

		const message = formatPseudoCapabilityError(findings);
		expect(message).toMatch(/manage_plan capability/);
		expect(message).toMatch(/how-to\.md:3/);
	});

	it("names every offending location, not just the first", async () => {
		const root = await treeWith({
			"skills/demo/references/a.md": "use `ask_user capability`",
			"skills/demo/references/b.md": "use `run_shell capability`",
		});
		const findings = findPseudoCapabilities(root);
		const message = formatPseudoCapabilityError(findings);
		expect(message).toMatch(/a\.md:1/);
		expect(message).toMatch(/b\.md:1/);
		expect(message).toMatch(/2 place\(s\)/);
	});
});

describe("the live canonical tree", () => {
	it("carries no unresolved pseudo-capability aliases", () => {
		// Guards the success criterion against regression in this repo itself.
		expect(findPseudoCapabilities(process.cwd(), [".claude"])).toEqual([]);
	});
});
