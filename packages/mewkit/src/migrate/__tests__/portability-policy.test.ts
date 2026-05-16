import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildPortableSkillsByProvider, filterPlanForPortability, getRuntimeBoundSignals } from "../portability-policy.js";
import type { PortableItem, PortableType, ProviderType, SkillInfo } from "../types.js";
import type { ReconcilePlan } from "../reconcile/reconcile-types.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(
		tempDirs.splice(0).map(async (dir) => {
			await import("node:fs/promises").then((fs) => fs.rm(dir, { recursive: true, force: true }));
		}),
	);
});

function makeItem(type: PortableType, name: string, body: string): PortableItem {
	return {
		name,
		description: "",
		type,
		sourcePath: `.claude/${type}/${name}.md`,
		frontmatter: {},
		body,
	};
}

function makePlan(actions: ReconcilePlan["actions"]): ReconcilePlan {
	return {
		actions,
		summary: { install: 0, update: 0, skip: 0, conflict: 0, delete: 0 },
		hasConflicts: false,
		banners: [],
	};
}

describe("portability policy", () => {
	it("detects concrete Claude runtime-bound signals", () => {
		const signals = getRuntimeBoundSignals("Use /mk:plan and update CLAUDE.md from .claude/rules/");
		expect(signals).toContain("mk/meow slash command");
		expect(signals).toContain("CLAUDE.md reference");
		expect(signals).toContain(".claude path");
	});

	it("filters runtime-bound agents and rules for non-Claude providers", () => {
		const agent = makeItem("agent", "analyst", "Route findings back to the orchestrator during Phase 6.");
		const config = makeItem("config", "CLAUDE", "Project contract");
		const plan = makePlan([
			{
				action: "install",
				item: "analyst",
				type: "agent",
				provider: "codex",
				global: false,
				targetPath: ".codex/agents/analyst.toml",
				reason: "new-item",
			},
			{
				action: "install",
				item: "CLAUDE",
				type: "config",
				provider: "codex",
				global: false,
				targetPath: ".codex/AGENTS.md",
				reason: "new-item",
			},
		]);

		const filtered = filterPlanForPortability(plan, {
			agent: [agent],
			command: [],
			skill: [],
			config: [config],
			rules: [],
			hooks: [],
		});

		expect(filtered.plan.actions).toHaveLength(1);
		expect(filtered.plan.actions[0]?.type).toBe("config");
		expect(filtered.plan.summary.install).toBe(1);
		expect(filtered.skipMessages.some((message) => /Skipped 1 agent/.test(message))).toBe(true);
	});

	it("keeps generic commands portable", () => {
		const command = makeItem("command", "docs/init", "Initialize the docs workspace and summarize the README.");
		const plan = makePlan([
			{
				action: "install",
				item: "docs/init",
				type: "command",
				provider: "gemini-cli",
				global: false,
				targetPath: ".gemini/commands/docs/init.toml",
				reason: "new-item",
			},
		]);

		const filtered = filterPlanForPortability(plan, {
			agent: [],
			command: [command],
			skill: [],
			config: [],
			rules: [],
			hooks: [],
		});

		expect(filtered.plan.actions).toHaveLength(1);
		expect(filtered.skipMessages).toEqual([]);
	});

	it("drops actions for provider surfaces that are not officially documented", () => {
		const command = makeItem("command", "mk/design", "Design the change and summarize the tradeoffs.");
		const config = makeItem("config", "CLAUDE", "Project contract");
		const plan = makePlan([
			{
				action: "install",
				item: "mk/design",
				type: "command",
				provider: "codex",
				global: false,
				targetPath: ".codex/prompts/mk-design.md",
				reason: "new-item",
			},
			{
				action: "install",
				item: "CLAUDE",
				type: "config",
				provider: "codex",
				global: false,
				targetPath: "AGENTS.md",
				reason: "new-item",
			},
		]);

		const filtered = filterPlanForPortability(plan, {
			agent: [],
			command: [command],
			skill: [],
			config: [config],
			rules: [],
			hooks: [],
		});

		expect(filtered.plan.actions).toHaveLength(1);
		expect(filtered.plan.actions[0]?.type).toBe("config");
		expect(filtered.plan.summary.install).toBe(1);
		expect(filtered.skipMessages).toContain(
			"Skipped 1 command for Codex: unsupported by Codex official docs for command migration",
		);
	});

	it("keeps skills available for provider-specific rewriting during install", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-portability-"));
		tempDirs.push(root);

		const portableDir = join(root, "portable-skill");
		await mkdir(portableDir, { recursive: true });
		await writeFile(
			join(portableDir, "SKILL.md"),
			"---\nname: portable-skill\ndescription: Generic helper\n---\nSummarize files and prepare a checklist.\n",
			"utf-8",
		);

		const boundDir = join(root, "workflow-orchestrator");
		await mkdir(boundDir, { recursive: true });
		await writeFile(
			join(boundDir, "SKILL.md"),
			"---\nname: workflow-orchestrator\ndescription: Bound\n---\nSee .claude/rules/orchestration-rules.md and run /mk:cook.\n",
			"utf-8",
		);

		const skills: SkillInfo[] = [
			{
				id: "mk:portable-skill",
				name: "portable-skill",
				dirName: "portable-skill",
				description: "Generic helper",
				sourcePath: portableDir,
			},
			{
				id: "mk:workflow-orchestrator",
				name: "workflow-orchestrator",
				dirName: "workflow-orchestrator",
				description: "Bound",
				sourcePath: boundDir,
			},
		];

		const result = await buildPortableSkillsByProvider(skills, ["codex", "cursor"] satisfies ProviderType[]);

		expect(result.skillsByProvider.get("codex")?.map((skill) => skill.name)).toEqual([
			"portable-skill",
			"workflow-orchestrator",
		]);
		expect(result.skillsByProvider.get("cursor")?.map((skill) => skill.name)).toEqual([
			"portable-skill",
			"workflow-orchestrator",
		]);
		expect(result.skipMessages).toEqual([]);
	});

	it("does not skip skills only because they mention workflow phases", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-portability-"));
		tempDirs.push(root);

		const phaseSkillDir = join(root, "phase-aware-skill");
		await mkdir(phaseSkillDir, { recursive: true });
		await writeFile(
			join(phaseSkillDir, "SKILL.md"),
			"---\nname: phase-aware-skill\ndescription: Phase-aware helper\n---\nOperates in Phase 3 (Build) and Phase 4 (Review).\n",
			"utf-8",
		);

		const skills: SkillInfo[] = [
			{
				id: "mk:phase-aware-skill",
				name: "phase-aware-skill",
				dirName: "phase-aware-skill",
				description: "Phase-aware helper",
				sourcePath: phaseSkillDir,
			},
		];

		const result = await buildPortableSkillsByProvider(skills, ["codex"] satisfies ProviderType[]);

		expect(result.skillsByProvider.get("codex")?.map((skill) => skill.name)).toEqual(["phase-aware-skill"]);
		expect(result.skipMessages).toEqual([]);
	});

});
