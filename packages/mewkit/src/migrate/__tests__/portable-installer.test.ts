import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeInstallAction } from "../portable-installer.js";
import { providers } from "../provider-registry.js";
import type { PortableItem } from "../types.js";

const originalCursorConfig = structuredClone(providers.cursor.config);
const originalCodexConfig = structuredClone(providers.codex.config);
const originalCodexRules = structuredClone(providers.codex.rules);
const originalCwd = process.cwd();
const tempDirs: string[] = [];

afterEach(() => {
	providers.cursor.config = structuredClone(originalCursorConfig);
	providers.codex.config = structuredClone(originalCodexConfig);
	providers.codex.rules = structuredClone(originalCodexRules);
	process.chdir(originalCwd);
	return Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("portable installer", () => {
	it("rejects target paths that escape the configured project boundary", async () => {
		const projectRoot = await mkdtemp(join(originalCwd, "tmp-mewkit-portable-installer-"));
		tempDirs.push(projectRoot);
		const safeConfigPath = join(projectRoot, ".cursor", "rules", "project-config.mdc");
		await mkdir(join(projectRoot, ".cursor", "rules"), { recursive: true });
		providers.cursor.config = {
			...providers.cursor.config!,
			projectPath: safeConfigPath,
			globalPath: safeConfigPath,
		};

		const sourcePath = join(projectRoot, "CLAUDE.md");
		await writeFile(sourcePath, "# config\n", "utf-8");

		const action = {
			action: "install" as const,
			item: "CLAUDE",
			type: "config" as const,
			provider: "cursor",
			global: false,
			targetPath: join(originalCwd, "..", "escaped.mdc"),
			reason: "test",
		};

		const sourceItem: PortableItem = {
			name: "CLAUDE",
			description: "config",
			type: "config",
			sourcePath,
			frontmatter: {},
			body: "# config\n",
		};

		const result = await executeInstallAction(action, {
			allItems: {
				agent: [],
				command: [],
				skill: [],
				config: [sourceItem],
				rules: [],
				hooks: [],
			},
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain("Unsafe path");
	});

	it("writes Codex config to repository AGENTS.md", async () => {
		const projectRoot = await mkdtemp(join(originalCwd, "tmp-mewkit-portable-installer-"));
		tempDirs.push(projectRoot);
		const targetPath = join(projectRoot, "AGENTS.md");
		process.chdir(projectRoot);
		providers.codex.config = {
			...providers.codex.config!,
			projectPath: targetPath,
			globalPath: targetPath,
		};

		const sourcePath = join(projectRoot, "CLAUDE.md");
		const sourceBody = "# Repository expectations\n\n- Run tests before opening a PR.\n";
		await writeFile(sourcePath, sourceBody, "utf-8");

		const action = {
			action: "install" as const,
			item: "CLAUDE",
			type: "config" as const,
			provider: "codex",
			global: false,
			targetPath,
			reason: "test",
		};

		const sourceItem: PortableItem = {
			name: "CLAUDE",
			description: "config",
			type: "config",
			sourcePath,
			frontmatter: {},
			body: sourceBody,
		};

		const result = await executeInstallAction(action, {
			allItems: {
				agent: [],
				command: [],
				skill: [],
				config: [sourceItem],
				rules: [],
				hooks: [],
			},
		});
		expect(result.success).toBe(true);
		await expect(readFile(targetPath, "utf-8")).resolves.toContain("Repository expectations");
	});

	it("writes Codex rules as native .rules files under .codex/rules", async () => {
		const projectRoot = await mkdtemp(join(originalCwd, "tmp-mewkit-portable-installer-"));
		tempDirs.push(projectRoot);
		const rulesRoot = join(projectRoot, ".codex", "rules");
		const targetPath = join(rulesRoot, "engineering", "standards.rules");
		process.chdir(projectRoot);
		providers.codex.rules = {
			...providers.codex.rules!,
			projectPath: rulesRoot,
			globalPath: rulesRoot,
		};

		const sourcePath = join(projectRoot, ".claude", "rules", "engineering", "standards.md");
		await mkdir(dirname(sourcePath), { recursive: true });
		const sourceBody = "Prefer `rg` for code search. Use `rg` instead of `grep`.\n";
		await writeFile(sourcePath, sourceBody, "utf-8");

		const action = {
			action: "install" as const,
			item: "engineering/standards",
			type: "rules" as const,
			provider: "codex",
			global: false,
			targetPath,
			reason: "test",
		};

		const sourceItem: PortableItem = {
			name: "engineering/standards",
			description: "rule",
			type: "rules",
			sourcePath,
			frontmatter: {},
			body: sourceBody,
		};

		const result = await executeInstallAction(action, {
			allItems: {
				agent: [],
				command: [],
				skill: [],
				config: [],
				rules: [sourceItem],
				hooks: [],
			},
		});
		expect(result.success).toBe(true);
		const written = await readFile(targetPath, "utf-8");
		expect(written).toContain('pattern = ["grep"]');
		expect(written).toContain('decision = "forbidden"');
	});

	it("accepts canonical target paths when the project root is entered through a symlink", async () => {
		const tempRoot = await mkdtemp(join(originalCwd, "tmp-mewkit-portable-installer-real-"));
		const symlinkRoot = `${tempRoot}-link`;
		tempDirs.push(tempRoot, symlinkRoot);
		await symlink(tempRoot, symlinkRoot);

		const targetPath = join(tempRoot, "AGENTS.md");
		process.chdir(symlinkRoot);
		providers.codex.config = {
			...providers.codex.config!,
			projectPath: "AGENTS.md",
			globalPath: join(originalCwd, ".codex-test-global", "AGENTS.md"),
		};

		const sourcePath = join(tempRoot, "CLAUDE.md");
		await writeFile(sourcePath, "# config\n", "utf-8");

		const sourceItem: PortableItem = {
			name: "CLAUDE",
			description: "config",
			type: "config",
			sourcePath,
			frontmatter: {},
			body: "# config\n",
		};

		const result = await executeInstallAction(
			{
				action: "install",
				item: "CLAUDE",
				type: "config",
				provider: "codex",
				global: false,
				targetPath,
				reason: "test",
			},
			{
				allItems: {
					agent: [],
					command: [],
					skill: [],
					config: [sourceItem],
					rules: [],
					hooks: [],
				},
			},
		);

		expect(result.success).toBe(true);
		await expect(readFile(targetPath, "utf-8")).resolves.toContain("# config");
	});
});
