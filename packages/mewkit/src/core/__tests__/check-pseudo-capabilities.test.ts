import { mkdtemp, mkdir, rm, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findPseudoCapabilities, scanForPseudoCapabilities } from "../check-pseudo-capabilities.js";
import { generatePluginPayload } from "../plugin-payload.js";

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

describe("build-plugin rejects a seeded alias", () => {
	/** Minimal but real source tree the payload generator accepts. */
	async function sourceTree(extra: Record<string, string> = {}): Promise<string> {
		return treeWith({
			"agents/dev.md": "---\nname: developer\n---\n\nDeveloper agent.\n",
			"skills/demo/SKILL.md": "---\nname: mk:demo\n---\n\nA clean skill.\n",
			"settings.json": JSON.stringify({ hooks: {} }),
			...extra,
		});
	}

	it("builds a clean tree without throwing", async () => {
		const src = await sourceTree();
		const out = await mkdtemp(join(tmpdir(), "plugin-out-"));
		tempDirs.push(out);
		expect(() => generatePluginPayload({ sourceDir: src, outDir: out })).not.toThrow();
	});

	// Mutation test — the success criterion: seeding the defect must fail the build.
	// A build that ships prose telling an agent to use a thing that does not exist
	// is shipping a broken instruction; the payload is the last place to catch it.
	it("throws with file:line when an alias is seeded", async () => {
		const src = await sourceTree({
			"skills/demo/references/how-to.md": "# How to\n\nFirst, use `manage_plan capability` to record the plan.\n",
		});
		const out = await mkdtemp(join(tmpdir(), "plugin-out-"));
		tempDirs.push(out);

		expect(() => generatePluginPayload({ sourceDir: src, outDir: out })).toThrow(/manage_plan capability/);
		expect(() => generatePluginPayload({ sourceDir: src, outDir: out })).toThrow(/how-to\.md:3/);
	});

	it("names every offending location, not just the first", async () => {
		const src = await sourceTree({
			"skills/demo/references/a.md": "use `ask_user capability`",
			"skills/demo/references/b.md": "use `run_shell capability`",
		});
		const out = await mkdtemp(join(tmpdir(), "plugin-out-"));
		tempDirs.push(out);
		try {
			generatePluginPayload({ sourceDir: src, outDir: out });
			expect.unreachable("expected the build to reject the seeded aliases");
		} catch (err) {
			const msg = String(err);
			expect(msg).toMatch(/a\.md:1/);
			expect(msg).toMatch(/b\.md:1/);
			expect(msg).toMatch(/2 place\(s\)/);
		}
	});
});

describe("the live canonical tree", () => {
	it("carries no unresolved pseudo-capability aliases", () => {
		// Guards the success criterion against regression in this repo itself.
		expect(findPseudoCapabilities(process.cwd(), [".claude"])).toEqual([]);
	});
});
