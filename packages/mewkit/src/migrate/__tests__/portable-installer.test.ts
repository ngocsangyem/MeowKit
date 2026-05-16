import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeInstallAction } from "../portable-installer.js";
import { providers } from "../provider-registry.js";
import type { PortableItem } from "../types.js";

const originalCursorConfig = structuredClone(providers.cursor.config);

afterEach(() => {
	providers.cursor.config = structuredClone(originalCursorConfig);
});

describe("portable installer", () => {
	it("rejects target paths that escape the configured project boundary", async () => {
		const projectRoot = await mkdtemp(join(tmpdir(), "mewkit-portable-installer-"));
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
			targetPath: join(projectRoot, "..", "escaped.mdc"),
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
});
