import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkStaleIndex, compareCounts, emitCounts } from "../check-stale-index.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const SCHEMA = JSON.stringify({
	properties: {
		owner: { enum: ["utility"] },
		criticality: { enum: ["medium"] },
		status: { enum: ["active"] },
		runtime: { enum: ["claude-code"] },
	},
});
const FM = "---\nname: mk:foo\nowner: utility\ncriticality: medium\nstatus: active\nruntime: claude-code\n---\n";

// A harness with exactly: 1 skill, 1 agent, 1 rule, 1 command, 1 hook.
async function makeRepo(readme: string, skillsIndex: string, agentsIndex: string, hooksIndex: string): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-stale-"));
	tempDirs.push(root);
	const c = join(root, ".claude");
	await mkdir(join(c, "schemas"), { recursive: true });
	await writeFile(join(c, "schemas", "harness-metadata-schema.json"), SCHEMA);
	await mkdir(join(c, "skills", "mk-foo"), { recursive: true });
	await writeFile(join(c, "skills", "mk-foo", "SKILL.md"), FM);
	await mkdir(join(c, "agents"), { recursive: true });
	await writeFile(join(c, "agents", "dev.md"), FM.replace("mk:foo", "dev"));
	await mkdir(join(c, "rules"), { recursive: true });
	await writeFile(join(c, "rules", "r1.md"), "# rule");
	await mkdir(join(c, "commands", "mk"), { recursive: true });
	await writeFile(join(c, "commands", "mk", "c1.md"), "# cmd");
	await mkdir(join(c, "hooks"), { recursive: true });
	await writeFile(join(c, "hooks", "h1.sh"), "#!/bin/sh\n");
	await writeFile(
		join(c, "harness-inventory.json"),
		JSON.stringify({
			schema_version: 1,
			artifacts: {
				"rules/r1.md": { owner: "utility", criticality: "medium", status: "active", runtime: "claude-code" },
				"commands/mk/c1.md": { owner: "utility", criticality: "medium", status: "active", runtime: "claude-code" },
				"hooks/h1.sh": { owner: "utility", criticality: "medium", status: "active", runtime: "claude-code" },
			},
		}),
	);
	await writeFile(join(root, "README.md"), readme);
	await mkdir(join(root, "website", ".vitepress"), { recursive: true });
	await writeFile(
		join(root, "website", ".vitepress", "config.ts"),
		"const description = '1 skills, 1 agents';\nconst jsonLd = '1 skills, 1 agents';\n",
	);
	await mkdir(join(root, "website", "workflows"), { recursive: true });
	await writeFile(join(root, "website", "workflows", "new-project.md"), "1 agents, 1 skills\n");
	await mkdir(join(root, "website", "reference", "skills"), { recursive: true });
	await writeFile(join(root, "website", "reference", "rules-index.md"), "all 1 agents\n");
	await writeFile(join(root, "website", "reference", "skills", "lazy-agent-loader.md"), "all 1 agents\n");
	await mkdir(join(root, "website", "core-concepts"), { recursive: true });
	await writeFile(join(root, "website", "core-concepts", "how-it-works.md"), "1 skills\n");
	await mkdir(join(root, "docs", "core"), { recursive: true });
	await writeFile(join(root, "docs", "core", "meowkit-architecture.md"), "1 domain skills; 1 rule files\n");
	await mkdir(join(c, "agents"), { recursive: true });
	await writeFile(join(c, "agents", "SKILLS_INDEX.md"), skillsIndex);
	await writeFile(join(c, "agents", "AGENTS_INDEX.md"), agentsIndex);
	await writeFile(join(c, "hooks", "HOOKS_INDEX.md"), hooksIndex);
	return root;
}

// Accurate docs for the 1/1/1/1/1 harness.
const README_OK = "1 skills · 1 agents · 1 commands · 1 rules · 1 hook scripts\n";
const SKILLS_OK = "Skills.\n`mk:foo`|utility|x|monolithic\n**Total**|**1**\n";
const AGENTS_OK = "[1]{agent_file,role}\n`dev.md`|core\n";
const HOOKS_OK = "**Hook count:** 1 shell hook scripts.\n- `h1.sh` — does a thing.\n";

describe("checkStaleIndex", () => {
	it("PASSES when README + indexes match the inventory", async () => {
		const root = await makeRepo(README_OK, SKILLS_OK, AGENTS_OK, HOOKS_OK);
		const results = checkStaleIndex(root);
		expect(results.some((r) => r.status === "fail")).toBe(false);
	});

	it("FAILS on a count drift (README claims wrong skill count)", async () => {
		const root = await makeRepo(
			"9 skills · 1 agents · 1 commands · 1 rules · 1 hook scripts\n",
			SKILLS_OK,
			AGENTS_OK,
			HOOKS_OK,
		);
		const results = checkStaleIndex(root);
		expect(results.some((r) => r.status === "fail" && r.detail.includes("declared 9, found 1"))).toBe(true);
	});

	it("FAILS when a website count drifts from the inventory", async () => {
		const root = await makeRepo(README_OK, SKILLS_OK, AGENTS_OK, HOOKS_OK);
		await writeFile(
			join(root, "website", ".vitepress", "config.ts"),
			"const description = '9 skills, 1 agents';\nconst jsonLd = '1 skills, 1 agents';\n",
		);
		expect(
			compareCounts(root).some((d) => d.source.includes("website/.vitepress") && d.declared === 9 && d.actual === 1),
		).toBe(true);
	});

	it("FAILS when a workflow page count drifts from the inventory", async () => {
		const root = await makeRepo(README_OK, SKILLS_OK, AGENTS_OK, HOOKS_OK);
		await writeFile(join(root, "website", "workflows", "new-project.md"), "1 agents, 9 skills\n");
		expect(
			compareCounts(root).some((d) => d.source.includes("workflows/new-project") && d.declared === 9 && d.actual === 1),
		).toBe(true);
	});

	it("FAILS on completeness (an agent id is missing from AGENTS_INDEX)", async () => {
		const root = await makeRepo(README_OK, SKILLS_OK, "[1]{agent_file,role}\n`other.md`|core\n", HOOKS_OK);
		const results = checkStaleIndex(root);
		expect(
			results.some((r) => r.status === "fail" && r.name.includes("AGENTS_INDEX") && r.detail.includes("dev")),
		).toBe(true);
	});

	it("FAILS when a count token cannot be found (never pass-on-no-match)", async () => {
		const root = await makeRepo("no counts here\n", SKILLS_OK, AGENTS_OK, HOOKS_OK);
		const diffs = compareCounts(root);
		expect(diffs.some((d) => d.source === "README.md" && d.label.includes("token not found"))).toBe(true);
	});

	it("emitCounts rewrites numbers but not curated prose", async () => {
		const staleReadme =
			"77 skills · 17 agents · 21 commands · 19 rules · 27 hook scripts\nKeep this curated sentence.\n";
		const root = await makeRepo(
			staleReadme,
			"Curated intro.\n`mk:foo`|utility|x|monolithic\n**Total**|**76**\n",
			AGENTS_OK,
			HOOKS_OK,
		);
		const changed = emitCounts(root);
		expect(changed).toContain("README.md");
		const readme = await readFile(join(root, "README.md"), "utf-8");
		expect(readme).toContain("1 skills");
		expect(readme).toContain("Keep this curated sentence.");
		const skills = await readFile(join(root, ".claude", "agents", "SKILLS_INDEX.md"), "utf-8");
		expect(skills).toContain("**Total**|**1**");
		expect(skills).toContain("Curated intro.");
		// emitCounts fixes numbers only — a re-check still flags any missing rows.
		expect(checkStaleIndex(root).every((r) => r.name !== "Count drift")).toBe(true);
	});
});
