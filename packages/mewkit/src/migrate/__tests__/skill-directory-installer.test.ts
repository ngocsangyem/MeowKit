import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
});
