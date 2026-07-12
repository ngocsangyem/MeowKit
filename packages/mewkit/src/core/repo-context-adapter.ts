// Per-provider repo-context ACQUISITION descriptors (Phase 5 slice 3). Given a provider, this
// names the host-native read + search tools the AGENT uses to acquire task-scoped evidence.
// MeowKit NEVER executes these tools — it is the outer harness: it selects the contract and
// records the resulting envelope (`context record`), while the inner runtime does the reading.
// This mirrors provider-projection.ts: a trusted constant that must not over-claim. A provider
// with no tested acquisition surface is `report-only` with null read/search — no capability to
// acquire is asserted, so the orchestrator falls back to host-provided paths only.

/** A host-native tool the agent invokes to acquire evidence (MeowKit only names it). */
export interface AcquisitionTool {
	/** Host-native/logical tool identifier — e.g. "Read", "Grep+Glob", "shell:ripgrep". */
	tool: string;
	/** Plain-language note on what the tool does / any advisory caveat. */
	note: string;
}

export interface AcquisitionDescriptor {
	provider: string;
	/** `supported` = typed host tools; `partial` = shell-mediated (advisory); `report-only` = none. */
	status: "supported" | "partial" | "report-only";
	/** How the host reads a file's content. null ⇒ no read surface (report-only). */
	read: AcquisitionTool | null;
	/** How the host searches for task-relevant paths/symbols. null ⇒ no search surface. */
	search: AcquisitionTool | null;
	/** Plain-language basis for the claim — what makes the status what it is. */
	evidence: string;
}

/** Providers whose acquisition surface is authored + evidenced. Others are report-only. */
export const ACQUISITION_DESCRIPTORS: Record<string, AcquisitionDescriptor> = {
	"claude-code": {
		provider: "claude-code",
		status: "supported",
		read: { tool: "Read", note: "typed host-native file read" },
		search: { tool: "Grep+Glob", note: "typed content search (Grep) + filename search (Glob)" },
		evidence: "Claude Code exposes typed Read/Grep/Glob tools the agent invokes to acquire evidence; MeowKit records the resulting envelope.",
	},
	"claude-plugin": {
		provider: "claude-plugin",
		status: "supported",
		read: { tool: "Read", note: "typed host-native file read (same Claude Code host)" },
		search: { tool: "Grep+Glob", note: "typed content + filename search (same Claude Code host)" },
		evidence: "The plugin runs in the Claude Code host — identical typed Read/Grep/Glob acquisition surface.",
	},
	codex: {
		provider: "codex",
		status: "partial",
		// Codex acquires through its shell, not a typed tool contract. Honest, not fabricated: we
		// name the shell tools it actually uses (cat/ripgrep) and mark the whole surface advisory.
		read: { tool: "shell:cat", note: "shell-mediated read — no typed read tool (advisory)" },
		search: { tool: "shell:ripgrep", note: "shell-mediated search — no typed search tool (advisory)" },
		evidence: "Codex acquires via its shell (cat/ripgrep), not a typed tool contract; acquisition works but is shell-mediated (advisory) ⇒ partial.",
	},
};

/** The acquisition descriptor for a provider, or a report-only fallback that claims nothing. */
export function getAcquisitionDescriptor(provider: string): AcquisitionDescriptor {
	return (
		ACQUISITION_DESCRIPTORS[provider] ?? {
			provider,
			status: "report-only",
			read: null,
			search: null,
			evidence: "No tested acquisition surface for this provider — report-only; the orchestrator relies on host-provided paths only.",
		}
	);
}
