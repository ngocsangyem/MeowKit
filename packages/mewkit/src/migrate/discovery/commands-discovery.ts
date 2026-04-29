// Vendored from claudekit-cli (MIT). Source: src/commands/commands/commands-discovery.ts
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseFrontmatterFile } from "../frontmatter-parser.js";
import type { PortableItem } from "../types.js";
import { MEOWKIT_INTERNAL_DIRS, isExcludedFile } from "./exclusions.js";

async function scanDir(dir: string, rootDir: string): Promise<PortableItem[]> {
	const items: PortableItem[] = [];

	let entries: import("node:fs").Dirent[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return items;
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			if (MEOWKIT_INTERNAL_DIRS.has(entry.name)) continue;
			if (entry.name.startsWith(".")) continue;
			const nested = await scanDir(fullPath, rootDir);
			items.push(...nested);
			continue;
		}

		if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
		if (isExcludedFile(entry.name)) continue;
		// Skip index/private files (per phase 2 plan)
		if (entry.name === "index.md" || entry.name.startsWith("_")) continue;

		try {
			const { frontmatter, body } = await parseFrontmatterFile(fullPath);
			const relPath = relative(rootDir, fullPath);
			const segments = relPath.replace(/\.md$/, "").split(/[/\\]/);
			const name = segments.join("/");
			const displayName = segments.join(":");

			items.push({
				name,
				displayName,
				description: frontmatter.description ?? "",
				type: "command",
				sourcePath: fullPath,
				frontmatter,
				body,
				segments,
			});
		} catch {
			// Non-fatal — skip
		}
	}

	return items;
}

export async function discoverCommands(sourcePath: string): Promise<PortableItem[]> {
	const items = await scanDir(sourcePath, sourcePath);
	return items.sort((a, b) => a.name.localeCompare(b.name));
}
