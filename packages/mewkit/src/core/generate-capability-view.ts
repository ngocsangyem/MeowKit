// Render the compatible portion of the trigger registry FROM the capability manifest,
// so that view is generated rather than separately hand-maintained (the current
// docs/architecture/trigger-registry.md drifts because it is manual). This module renders
// the markdown; splicing it into the doc between markers / CI drift-checking that region
// is a documented follow-up. Only capabilities that carry intents (flagship + authored)
// appear — a capability with no selection terms has nothing to surface here.
import type { CapabilityEntry } from "./capability.js";

/** Region markers a future in-place splice/drift-check will delimit within the doc. */
export const VIEW_START = "<!-- GENERATED:capabilities START -->";
export const VIEW_END = "<!-- GENERATED:capabilities END -->";

function escapeCell(s: string): string {
	return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** Render capabilities-with-intents as a stable markdown table (sorted by id). */
export function renderCapabilityView(entries: CapabilityEntry[]): string {
	const rows = entries
		.filter((e) => e.intents.length > 0)
		.slice()
		.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
		.map((e) => {
			const invocation = `${e.invocation.kind}:${e.invocation.id}`;
			const source = e.provenance.intents === "authored" ? "authored" : "inferred";
			return `| \`${escapeCell(e.id)}\` | ${e.kind} | ${invocation} | ${source} | ${escapeCell(e.intents.join("; "))} |`;
		});

	return [
		"| Capability | Kind | Invocation | Intent source | Intents (user phrases) |",
		"|---|---|---|---|---|",
		...rows,
	].join("\n");
}
