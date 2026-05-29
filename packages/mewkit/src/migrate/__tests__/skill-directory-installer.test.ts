import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../reconcile/portable-registry.js", () => ({
	addPortableInstallation: vi.fn(async () => undefined),
}));
import { installSkillDirectory } from "../skill-directory-installer.js";
import { providers } from "../provider-registry.js";
import { addPortableInstallation } from "../reconcile/portable-registry.js";
import type { SkillInfo } from "../types.js";

const originalCodexSkills = structuredClone(providers.codex.skills);

afterEach(() => {
	providers.codex.skills = structuredClone(originalCodexSkills);
	vi.mocked(addPortableInstallation).mockReset();
	vi.mocked(addPortableInstallation).mockResolvedValue(undefined);
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

	it("fails non-Claude skill install when copied scripts keep Claude runtime variables", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-skill-installer-"));
		const skillDir = join(root, ".claude", "skills", "runner");
		const targetSkillsRoot = join(root, ".agents", "skills");
		await mkdir(skillDir, { recursive: true });
		await mkdir(targetSkillsRoot, { recursive: true });
		await writeFile(join(skillDir, "SKILL.md"), "# runner\n", "utf-8");
		await writeFile(join(skillDir, "run.sh"), "echo $CLAUDE_PROJECT_DIR\n", "utf-8");

		providers.codex.skills = {
			...providers.codex.skills!,
			projectPath: targetSkillsRoot,
			globalPath: targetSkillsRoot,
		};

		const result = await installSkillDirectory(
			{
				id: "mk:runner",
				name: "runner",
				dirName: "runner",
				description: "runner skill",
				sourcePath: skillDir,
			},
			"codex",
			{ global: false },
		);

		expect(result.success).toBe(false);
		expect(result.error).toContain("Skill runtime compatibility audit failed");
		expect(result.error).toContain("run.sh");
		await expect(access(join(targetSkillsRoot, "runner"))).rejects.toThrow();
		expect(addPortableInstallation).not.toHaveBeenCalled();
	});

	it("skips binary files during copied skill audit", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-skill-installer-"));
		const skillDir = join(root, ".claude", "skills", "binary-safe");
		const targetSkillsRoot = join(root, ".agents", "skills");
		await mkdir(skillDir, { recursive: true });
		await mkdir(targetSkillsRoot, { recursive: true });
		await writeFile(join(skillDir, "SKILL.md"), "# binary safe\n", "utf-8");
		await writeFile(join(skillDir, "image.bin"), Buffer.from([0, 1, 2, 3]));

		providers.codex.skills = {
			...providers.codex.skills!,
			projectPath: targetSkillsRoot,
			globalPath: targetSkillsRoot,
		};

		const result = await installSkillDirectory(
			{
				id: "mk:binary-safe",
				name: "binary-safe",
				dirName: "binary-safe",
				description: "binary safe skill",
				sourcePath: skillDir,
			},
			"codex",
			{ global: false },
		);

		expect(result.success).toBe(true);
		expect(addPortableInstallation).toHaveBeenCalledOnce();
	});

	it("restores a previous target directory when skill audit fails", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-skill-installer-"));
		const skillDir = join(root, ".claude", "skills", "runner");
		const targetSkillsRoot = join(root, ".agents", "skills");
		const targetSkillDir = join(targetSkillsRoot, "runner");
		await mkdir(skillDir, { recursive: true });
		await mkdir(targetSkillDir, { recursive: true });
		await writeFile(join(skillDir, "SKILL.md"), "# runner\n", "utf-8");
		await writeFile(join(skillDir, "run.py"), "print('$ANTHROPIC_API_KEY')\n", "utf-8");
		await writeFile(join(targetSkillDir, "SKILL.md"), "# previous\n", "utf-8");

		providers.codex.skills = {
			...providers.codex.skills!,
			projectPath: targetSkillsRoot,
			globalPath: targetSkillsRoot,
		};

		const result = await installSkillDirectory(
			{
				id: "mk:runner",
				name: "runner",
				dirName: "runner",
				description: "runner skill",
				sourcePath: skillDir,
			},
			"codex",
			{ global: false },
		);

		expect(result.success).toBe(false);
		await expect(readFile(join(targetSkillDir, "SKILL.md"), "utf-8")).resolves.toBe("# previous\n");
		expect(addPortableInstallation).not.toHaveBeenCalled();
	});

	it("restores a previous target directory when registry write fails", async () => {
		const root = await mkdtemp(join(tmpdir(), "mewkit-skill-installer-"));
		const skillDir = join(root, ".claude", "skills", "registry-fail");
		const targetSkillsRoot = join(root, ".agents", "skills");
		const targetSkillDir = join(targetSkillsRoot, "registry-fail");
		await mkdir(skillDir, { recursive: true });
		await mkdir(targetSkillDir, { recursive: true });
		await writeFile(join(skillDir, "SKILL.md"), "# new\n", "utf-8");
		await writeFile(join(targetSkillDir, "SKILL.md"), "# previous\n", "utf-8");
		vi.mocked(addPortableInstallation).mockRejectedValueOnce(new Error("registry unavailable"));

		providers.codex.skills = {
			...providers.codex.skills!,
			projectPath: targetSkillsRoot,
			globalPath: targetSkillsRoot,
		};

		const result = await installSkillDirectory(
			{
				id: "mk:registry-fail",
				name: "registry-fail",
				dirName: "registry-fail",
				description: "registry fail skill",
				sourcePath: skillDir,
			},
			"codex",
			{ global: false },
		);

		expect(result.success).toBe(false);
		expect(result.error).toContain("registry unavailable");
		await expect(readFile(join(targetSkillDir, "SKILL.md"), "utf-8")).resolves.toBe("# previous\n");
	});
});
