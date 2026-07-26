// Generated sections for the reference index pages.
//
// These replace the "incomplete discoverability" the docs audit found: hand-maintained indexes
// that quietly fell behind the tree they indexed. Each section is marker-delimited and additive,
// so the editorial grouping above it — which encodes judgement the frontmatter cannot — survives
// regeneration untouched.
import type { DocsReferenceEntry } from "./docs-reference-manifest.js";
import type { HooksInventory } from "./build-hooks-inventory.js";
import { tableCell as cell, codeCell } from "./mdx-table-cell.js";

export const INDEX_START = "{/* GENERATED:reference-index START */}";
export const INDEX_END = "{/* GENERATED:reference-index END */}";

/** `skills/cook/SKILL.md` → `cook`; `agents/planner.md` → `planner`. */
function slugOf(entry: DocsReferenceEntry): string {
	const parts = entry.sourcePath.split(/[\\/]/);
	return entry.kind === "skill"
		? (parts[parts.length - 2] ?? "")
		: (parts[parts.length - 1] ?? "").replace(/\.md$/, "");
}

function wrap(lines: string[]): string {
	return [INDEX_START, "", ...lines, "", INDEX_END].join("\n");
}

/**
 * The complete alphabetical list for a kind.
 *
 * Complete is the point. The curated sections above group by workflow phase, which reads better
 * and is where a person actually looks — but only 48 of 167 artifacts declare a phase, so that
 * grouping cannot be generated and cannot be proven complete. This can.
 */
export function renderArtifactIndex(entries: DocsReferenceEntry[], kind: "skill" | "agent"): string {
	const rows = entries
		.filter((e) => e.kind === kind)
		.map((e) => `| [${codeCell(e.id)}](/reference/${kind}s/${slugOf(e)}) | ${cell(e.description)} |`);

	return wrap([
		`## Every ${kind}`,
		"",
		`_Generated from \`.claude/\`. Every ${kind} on disk appears here; the sections above group the ones you reach for most._`,
		"",
		`| ${kind === "skill" ? "Skill" : "Agent"} | What it does |`,
		"|---|---|",
		...rows,
	]);
}

/**
 * The registered lifecycle hooks.
 *
 * Deliberately three columns. Script paths, timeouts, and matcher chains are omitted by decision:
 * an inventory carrying them tells a reader which file to disable to get past a gate.
 */
export function renderHooksIndex(inventory: HooksInventory): string {
	const rows = inventory.entries.map(
		(h) => `| ${codeCell(h.event)} | ${cell(h.purpose)} | ${h.blocking ? "**Blocking**" : "Advisory"} |`,
	);

	const lines = [
		"## Registered hooks",
		"",
		"_Generated from `.claude/settings.json`, so a registered hook cannot be missing here._",
		"",
		"**Blocking** means the hook can stop the action. Advisory means it observes and reports.",
		"Script paths, timeouts, and matcher chains are intentionally not listed; read",
		"`.claude/settings.json` for the wiring.",
		"",
		"| Event | Purpose | Can it block? |",
		"|---|---|---|",
		...rows,
	];

	if (inventory.emptyEvents.length > 0) {
		lines.push("", `Registered with no hooks today: ${inventory.emptyEvents.map((e) => `\`${e}\``).join(", ")}.`);
	}

	return wrap(lines);
}

/** Replace the generated section, or append it when the page has no marker yet. */
export function spliceIndex(body: string, block: string): string {
	const start = body.indexOf(INDEX_START);
	const end = body.indexOf(INDEX_END);
	if (start !== -1 && end > start) {
		return body.slice(0, start) + block + body.slice(end + INDEX_END.length);
	}
	return `${body.replace(/\s*$/, "")}\n\n${block}\n`;
}
