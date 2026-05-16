import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../reconcile/portable-registry.js", () => ({
	addPortableInstallation: vi.fn(async () => undefined),
}));
import { installSkillDirectory } from "../skill-directory-installer.js";
import { providers } from "../provider-registry.js";
import type { SkillInfo } from "../types.js";

const originalCodexSkills = structuredClone(providers.codex.skills);

afterEach(() => {
	providers.codex.skills = structuredClone(originalCodexSkills);
});

describe("skill directory installer", () => {
	it("skips when the target skill directory is already the source directory", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-skill-installer-"));
		const skillsRoot = join(root, ".agents", "skills");
		const skillDir = join(skillsRoot, "cook");
		await mkdir(skillDir, { recursive: true });
		await writeFile(join(skillDir, "SKILL.md"), "# cook\n", "utf-8");

		providers.codex.skills = {
			...providers.codex.skills!,
			projectPath: skillsRoot,
			globalPath: skillsRoot,
		};

		const skill: SkillInfo = {
			id: "mk:cook",
			name: "cook",
			dirName: "cook",
			description: "cook skill",
			sourcePath: skillDir,
		};

		const result = await installSkillDirectory(skill, "codex", { global: false });

		expect(result.success).toBe(true);
		expect(result.path).toBe(skillDir);
	});

	it("rewrites markdown files inside migrated skills for the target runtime", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-skill-installer-"));
		const sourceRoot = join(root, ".claude", "skills");
		const skillDir = join(sourceRoot, "analyst");
		const refsDir = join(skillDir, "references");
		const targetSkillsRoot = join(root, ".agents", "skills");
		await mkdir(refsDir, { recursive: true });
		await mkdir(targetSkillsRoot, { recursive: true });
		await writeFile(
			join(skillDir, "SKILL.md"),
			"Use CLAUDE.md and .claude/rules/ during Phase 3. Run /mk:review when done.\n",
			"utf-8",
		);
		await writeFile(join(refsDir, "notes.md"), "See .claude/agents/reviewer and CLAUDE.md.\n", "utf-8");

		providers.codex.skills = {
			...providers.codex.skills!,
			projectPath: targetSkillsRoot,
			globalPath: targetSkillsRoot,
		};

		const skill: SkillInfo = {
			id: "mk:analyst",
			name: "analyst",
			dirName: "analyst",
			description: "analyst skill",
			sourcePath: skillDir,
		};

		const result = await installSkillDirectory(skill, "codex", { global: false });

		expect(result.success).toBe(true);
		const migratedSkill = await readFile(join(targetSkillsRoot, "analyst", "SKILL.md"), "utf-8");
		const migratedRef = await readFile(join(targetSkillsRoot, "analyst", "references", "notes.md"), "utf-8");
		expect(migratedSkill).toContain("AGENTS.md");
		expect(migratedSkill).not.toContain("/mk:review");
		expect(migratedSkill).not.toContain(".claude/");
		expect(migratedRef).toContain(".codex/agents");
		expect(migratedRef).not.toContain("CLAUDE.md");
	});
});
