// Vendored from claudekit-cli (MIT). Source: src/commands/agents/agents-discovery.ts
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatterFile } from "../frontmatter-parser.js";
import type { PortableItem } from "../types.js";
import { isExcludedFile } from "./exclusions.js";

export async function discoverAgents(sourcePath: string): Promise<PortableItem[]> {
	const items: PortableItem[] = [];

	let entries: import("node:fs").Dirent[];
	try {
		entries = await readdir(sourcePath, { withFileTypes: true });
	} catch {
		return items;
	}

	for (const entry of entries) {
		if (!entry.isFile()) continue;
		if (!entry.name.endsWith(".md")) continue;
		if (isExcludedFile(entry.name)) continue;

		const filePath = join(sourcePath, entry.name);
		try {
			const { frontmatter, body } = await parseFrontmatterFile(filePath);
			const name = entry.name.replace(/\.md$/, "");
			items.push({
				name,
				displayName: frontmatter.name ?? name,
				description: frontmatter.description ?? "",
				type: "agent",
				sourcePath: filePath,
				frontmatter,
				body,
			});
		} catch {
			// Non-fatal — skip unparseable files
		}
	}

	return items.sort((a, b) => a.name.localeCompare(b.name));
}
