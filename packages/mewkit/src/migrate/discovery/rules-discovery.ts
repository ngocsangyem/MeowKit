// Vendored from claudekit-cli (MIT). Source: src/commands/portable/config-discovery.ts (discoverRules variant)
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import type { PortableItem } from "../types.js";
import { isExcludedFile } from "./exclusions.js";

async function scanRulesDir(dir: string, base: string): Promise<PortableItem[]> {
	const items: PortableItem[] = [];
	let entries: import("node:fs").Dirent[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return items;
	}

	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;
		const fullPath = join(dir, entry.name);

		if (entry.isSymbolicLink()) continue;

		if (entry.isDirectory()) {
			const nested = await scanRulesDir(fullPath, base);
			items.push(...nested);
			continue;
		}

		if (!entry.isFile()) continue;
		if (extname(entry.name).toLowerCase() !== ".md") continue;
		if (isExcludedFile(entry.name)) continue;

		const relPath = relative(base, fullPath).split(/[/\\]/).join("/");
		const name = relPath.replace(/\.md$/, "");
		try {
			const content = await readFile(fullPath, "utf-8");
			items.push({
				name,
				description: `Rule: ${name}`,
				type: "rules",
				sourcePath: fullPath,
				frontmatter: {},
				body: content,
			});
		} catch {
			// Non-fatal
		}
	}

	return items;
}

export async function discoverRules(sourcePath: string): Promise<PortableItem[]> {
	return scanRulesDir(sourcePath, sourcePath);
}
