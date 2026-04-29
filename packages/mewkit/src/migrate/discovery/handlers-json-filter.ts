// Filter handlers.json: drop entries pointing at filtered-out shell hooks so target dispatcher
// doesn't reference non-existent files at runtime (Red Team Finding 6).
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface HandlersJson {
	[event: string]: Array<{ command?: string; script?: string; [key: string]: unknown }> | unknown;
}

export interface FilteredHandlers {
	json: HandlersJson | null;
	droppedEntries: Array<{ event: string; reference: string }>;
}

function referencedScript(entry: { command?: string; script?: string }): string | null {
	const ref = entry.script ?? entry.command;
	if (!ref || typeof ref !== "string") return null;
	const match = ref.match(/[\w./-]+\.(sh|ps1|bat|cmd|py)\b/i);
	return match ? match[0] : null;
}

export async function filterHandlersJson(
	hooksDir: string,
	skippedShellHooks: string[],
): Promise<FilteredHandlers> {
	const handlersPath = join(hooksDir, "handlers.json");
	if (!existsSync(handlersPath)) return { json: null, droppedEntries: [] };

	let raw: HandlersJson;
	try {
		const content = await readFile(handlersPath, "utf-8");
		raw = JSON.parse(content) as HandlersJson;
	} catch {
		return { json: null, droppedEntries: [] };
	}

	const droppedEntries: FilteredHandlers["droppedEntries"] = [];
	const filtered: HandlersJson = {};

	for (const [event, value] of Object.entries(raw)) {
		if (!Array.isArray(value)) {
			filtered[event] = value;
			continue;
		}

		const kept = (value as Array<{ command?: string; script?: string }>).filter((entry) => {
			const ref = referencedScript(entry);
			if (!ref) return true;
			const matches = skippedShellHooks.some((skipped) => ref.endsWith(skipped));
			if (matches) {
				droppedEntries.push({ event, reference: ref });
				return false;
			}
			return true;
		});

		if (kept.length > 0) filtered[event] = kept;
	}

	return { json: filtered, droppedEntries };
}
