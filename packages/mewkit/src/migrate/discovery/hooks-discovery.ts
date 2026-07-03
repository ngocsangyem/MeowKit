// Vendored from claudekit-cli (MIT). Source: src/commands/portable/config-discovery.ts (discoverHooks variant)
// MeowKit-specific: classifies every hook handler by runtime type (js | sh). `.sh` handlers
// are NOT skipped — they migrate through a copy-script + generated .cjs wrapper (see
// hooks/codex-hook-wrapper.ts). Truly-unrunnable-on-a-node/sh-wrapper types (.ps1/.bat/.cmd/.py)
// are reported as skipped with a structured record rather than dropped silently.
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { PortableItem } from "../types.js";

const NODE_RUNNABLE = new Set([".js", ".cjs", ".mjs", ".ts"]);
// Shell scripts that a portable node wrapper can shell out to via /bin/sh.
const SHELL_RUNNABLE = new Set([".sh"]);
// Handler types with no portable execution path on the codex output tree.
const UNSUPPORTED_HANDLER_EXT = new Set([".ps1", ".bat", ".cmd", ".py"]);

/** Runtime classification of a hook handler, consumed by the wrapper generator. */
export type HookHandlerType = "js" | "sh";

export interface HookDiscoveryResult {
	items: PortableItem[];
	/** Handlers with no portable execution path (.ps1/.bat/.cmd/.py) — reported, not migrated. */
	skippedShellHooks: string[];
}

/** Classify a hook filename into a runtime handler type, or null if unsupported. */
export function classifyHookHandler(fileName: string): HookHandlerType | null {
	const ext = extname(fileName).toLowerCase();
	if (NODE_RUNNABLE.has(ext)) return "js";
	if (SHELL_RUNNABLE.has(ext)) return "sh";
	return null;
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

		if (UNSUPPORTED_HANDLER_EXT.has(ext)) {
			skippedShellHooks.push(entry.name);
			continue;
		}

		const handlerType = classifyHookHandler(entry.name);
		if (!handlerType) continue;

		const fullPath = join(sourcePath, entry.name);
		try {
			const content = await readFile(fullPath, "utf-8");
			items.push({
				name: entry.name,
				description: `Hook: ${entry.name}`,
				type: "hooks",
				sourcePath: fullPath,
				frontmatter: { handlerType },
				body: content,
			});
		} catch {
			// Non-fatal — skip
		}
	}

	return { items, skippedShellHooks };
}
