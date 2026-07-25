// Apply the generated facts block across every reference page, or report which ones are stale.
//
// Kept beside the manifest rather than in the command because the two are one contract: the
// manifest records what the runtime declares, and these pages restate it. Checking one without
// the other lets a page drift while its manifest entry stays green.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DocsReferenceEntry } from "./docs-reference-manifest.js";
import { renderReferenceFacts, spliceReferenceFacts } from "./render-reference-facts.js";

export interface SpliceResult {
	/** Pages whose generated block differs from what the manifest would produce. */
	stale: string[];
	/** Pages the manifest expects but which do not exist. */
	missing: string[];
	/** Pages written, when writing. */
	written: string[];
	checked: number;
}

/** `skills/cook/SKILL.md` → `skills/cook.mdx`; `agents/planner.md` → `agents/planner.mdx`. */
function pageRelFor(entry: DocsReferenceEntry): string {
	const parts = entry.sourcePath.split(/[\\/]/);
	const slug =
		entry.kind === "skill"
			? (parts[parts.length - 2] ?? "")
			: (parts[parts.length - 1] ?? "").replace(/\.md$/, "");
	return join(`${entry.kind}s`, `${slug}.mdx`);
}

export function spliceReferencePages(
	referenceDir: string,
	entries: DocsReferenceEntry[],
	opts: { write: boolean },
): SpliceResult {
	const result: SpliceResult = { stale: [], missing: [], written: [], checked: 0 };

	for (const entry of entries) {
		const rel = pageRelFor(entry);
		const abs = join(referenceDir, rel);
		if (!existsSync(abs)) {
			result.missing.push(rel);
			continue;
		}
		result.checked++;

		const body = readFileSync(abs, "utf-8");
		const next = spliceReferenceFacts(body, renderReferenceFacts(entry));
		if (next === body) continue;

		if (opts.write) {
			writeFileSync(abs, next, "utf-8");
			result.written.push(rel);
		} else {
			result.stale.push(rel);
		}
	}

	return result;
}
