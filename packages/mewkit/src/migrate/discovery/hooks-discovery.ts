// Vendored from claudekit-cli (MIT). Source: src/commands/portable/config-discovery.ts (discoverHooks variant)
// MeowKit-specific: filters shell hooks (.sh/.ps1/.bat/.cmd) and reports them separately so user is informed.
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { PortableItem } from "../types.js";

const NODE_RUNNABLE = new Set([".js", ".cjs", ".mjs", ".ts"]);
const SHELL_HOOK_EXT = new Set([".sh", ".ps1", ".bat", ".cmd", ".py"]);

export interface HookDiscoveryResult {
	items: PortableItem[];
	skippedShellHooks: string[];
}

export async function discoverHooks(sourcePath: string): Promise<HookDiscoveryResult> {
	let entries: import("node:fs").Dirent[];
	try {
		entries = await readdir(sourcePath, { withFileTypes: true });
	} catch {
		return { items: [], skippedShellHooks: [] };
	}

	const items: PortableItem[] = [];
	const skippedShellHooks: string[] = [];

	for (const entry of entries) {
		if (!entry.isFile() || entry.name.startsWith(".")) continue;
		const ext = extname(entry.name).toLowerCase();
		if (SHELL_HOOK_EXT.has(ext)) {
			skippedShellHooks.push(entry.name);
			continue;
		}
		if (!NODE_RUNNABLE.has(ext)) continue;

		const fullPath = join(sourcePath, entry.name);
		try {
			const content = await readFile(fullPath, "utf-8");
			items.push({
				name: entry.name,
				description: `Hook: ${entry.name}`,
				type: "hooks",
				sourcePath: fullPath,
				frontmatter: {},
				body: content,
			});
		} catch {
			// Non-fatal — skip
		}
	}

	return { items, skippedShellHooks };
}
