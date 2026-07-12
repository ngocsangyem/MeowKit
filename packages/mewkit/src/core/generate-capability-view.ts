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

/**
 * Extract the content strictly between the generated-region markers, trimmed. Returns null when
 * either marker is absent or END precedes START (malformed / not yet spliced) — the caller treats
 * that as "no generated region", NOT as drift.
 */
export function extractGeneratedRegion(docText: string): string | null {
	const start = docText.indexOf(VIEW_START);
	const end = docText.indexOf(VIEW_END);
	if (start === -1 || end === -1 || end < start) return null;
	return docText.slice(start + VIEW_START.length, end).trim();
}

export type ViewDriftState = "absent-markers" | "in-sync" | "drift";

/**
 * Compare a doc's spliced generated region against a freshly-rendered view. The registry
 * (`entries`) is the source of truth; the doc must NOT become a second editable truth. A doc with
 * no markers is `absent-markers` (the region has not been spliced yet — honest, not a failure);
 * matching content is `in-sync`; differing content is `drift` (regenerate + re-splice).
 */
export function capabilityViewDrift(docText: string, entries: CapabilityEntry[]): ViewDriftState {
	const region = extractGeneratedRegion(docText);
	if (region === null) return "absent-markers";
	return region === renderCapabilityView(entries).trim() ? "in-sync" : "drift";
}
