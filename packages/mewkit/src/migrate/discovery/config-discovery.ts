// Vendored from claudekit-cli (MIT). Source: src/commands/portable/config-discovery.ts (discoverConfig only)
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { PortableItem } from "../types.js";

export async function discoverConfig(configPath: string): Promise<PortableItem | null> {
	if (!existsSync(configPath)) return null;

	const content = await readFile(configPath, "utf-8");
	return {
		name: "CLAUDE",
		description: "Project configuration",
		type: "config",
		sourcePath: configPath,
		frontmatter: {},
		body: content,
	};
}
