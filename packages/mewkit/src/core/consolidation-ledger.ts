// Consolidation & safe-deprecation ledger. The ledger itself SCHEDULES no deletions: the
// discipline is "remove duplicate sources only after runtime traces, Aspire validation, plugin
// payload checks, and a transition release show which path is canonical" and "no candidate is
// deleted solely due to absent static references." This module is the durable RECORD of that
// discipline — every consolidation candidate carries its purpose, static + runtime evidence,
// external-consumer risk, confidence, transition behavior, rollback, verification, and the gates
// still outstanding before any removal. `deletionThisPhase` is the literal `false` for every entry
// (a compile-time guarantee that this ledger schedules no deletion). When a candidate is actually
// removed elsewhere — e.g. the orchviz command, retired by the visual-plan work once mk:visual-plan
// superseded it — its entry is retained here for provenance, with staticEvidence recording the
// removal. Doctor surfaces the status HONESTLY — an authoring-only/experimental/deprecated label is
// NOT a runtime-availability claim (a deprecated artifact may still be fully functional at runtime).

/** Classification. `canonical` = the source of truth; `keep-legacy` = retained cheap read path;
 * `authoring-only`/`experimental` = present but not production-critical; `deprecated` = flagged for
 * eventual retirement; `undecided` = needs evidence before any classification. */
export type ConsolidationStatus =
	| "canonical"
	| "keep-legacy"
	| "authoring-only"
	| "experimental"
	| "deprecated"
	| "undecided";

export interface ConsolidationCandidate {
	id: string;
	purpose: string;
	status: ConsolidationStatus;
	/** What the static evidence (code refs, generators, existing checks) shows. */
	staticEvidence: string;
	/** What runtime traces show. Honest "none yet" where this session has no traces/release. */
	runtimeEvidence: string;
	externalConsumerRisk: "low" | "medium" | "high" | "unknown";
	confidence: "low" | "medium" | "high";
	/** How a future transition release would behave (dual-write, generate-in-place, etc.). */
	transitionBehavior: string;
	/** How to roll back if the transition regresses. */
	rollback: string;
	/** Aspire-local + plugin-payload verification status. */
	verification: string;
	/** LITERAL false for every entry — Phase 7 removes nothing; the type forbids scheduling one. */
	deletionThisPhase: false;
	/** What must be true before ANY removal/retirement of this candidate. */
	remainingGates: string[];
}

const NO_RUNTIME = "none yet — no runtime traces or transition release in this session";

/** The consolidation candidates from the Phase 7 plan, each fully recorded. Ordered by id. */
export const CONSOLIDATION_LEDGER: ConsolidationCandidate[] = [
	{
		id: "generated-tables",
		purpose: "Trigger/capability tables + contributor indexes rendered FROM the registry (the manual docs/architecture/trigger-registry.md drifts).",
		status: "canonical",
		staticEvidence: "generate-capability-view.ts renders the table + declares region markers for an in-place splice/drift-check; the registry (buildCapabilities) is the source of truth.",
		runtimeEvidence: NO_RUNTIME,
		externalConsumerRisk: "low",
		confidence: "high",
		transitionBehavior: "Splice the generated region into the doc between markers; CI drift-checks that region. Human rationale stays OUTSIDE the generated region.",
		rollback: "Remove the spliced region; the manual doc remains readable.",
		verification: "capability view unit-tested; doc splice + drift-check not yet wired.",
		deletionThisPhase: false,
		remainingGates: ["splice generated region into the doc", "add a CI drift-check for the region"],
	},
	{
		id: "contributor-indexes",
		purpose: "Contributor-only index files that may not belong in the shipped plugin payload.",
		status: "undecided",
		staticEvidence: "Indexes exist in .claude/; no static proof of a dynamic (runtime) consumer either way.",
		runtimeEvidence: NO_RUNTIME,
		externalConsumerRisk: "medium",
		confidence: "low",
		transitionBehavior: "Prune from the plugin payload only after confirming no dynamic consumer; keep in the authoring repo.",
		rollback: "Re-include the index in the plugin payload build.",
		verification: "plugin payload check not yet run for this candidate.",
		deletionThisPhase: false,
		remainingGates: ["confirm no dynamic consumer via runtime trace", "plugin payload fixture proving no regression"],
	},
	{
		id: "legacy-manifest-writes",
		purpose: "Legacy manifest WRITE path superseded by the current install-metadata writer.",
		status: "deprecated",
		staticEvidence: "install-metadata writer is the current path; legacy writes are still emitted for back-compat.",
		runtimeEvidence: NO_RUNTIME,
		externalConsumerRisk: "medium",
		confidence: "medium",
		transitionBehavior: "Retire legacy WRITES only after the rollback window; keep cheap legacy READS for version-skipping consumers.",
		rollback: "Re-enable the legacy writer (kept behind the read path).",
		verification: "upgrade/migrate suites green; rollback window not yet elapsed.",
		deletionThisPhase: false,
		remainingGates: ["rollback window elapses", "upgrade suite proves no version-skip consumer breaks"],
	},
	{
		id: "json-canonical-memory",
		purpose: "JSON as the canonical memory WRITE path; Markdown as generated views.",
		status: "canonical",
		staticEvidence: "memory-read-rules.md: JSON is canonical, .md are generated views (mewkit memory render-views); permanent .md fallback for pre-migration projects.",
		runtimeEvidence: NO_RUNTIME,
		externalConsumerRisk: "medium",
		confidence: "medium",
		transitionBehavior: "Keep generated MD views + permanent .md fallback until every CLI/skill/agent consumer is proven to read JSON.",
		rollback: "Fallback to .md read path (already permanent).",
		verification: "render-views exists; full consumer audit pending.",
		deletionThisPhase: false,
		remainingGates: ["audit every memory consumer reads JSON", "migration evidence before dropping the .md fallback"],
	},
	{
		id: "substrate",
		purpose: "Responsibility-substrate coverage view (inventory --substrate).",
		status: "authoring-only",
		staticEvidence: "substrate.ts renders a coverage view for authoring/audit; no production runtime path depends on it.",
		runtimeEvidence: NO_RUNTIME,
		externalConsumerRisk: "low",
		confidence: "medium",
		transitionBehavior: "Classify authoring-only; keep available, not shipped as a production capability, until a real consumer justifies production status.",
		rollback: "n/a — no removal; reclassify if a consumer appears.",
		verification: "substrate view unit-tested; no production consumer identified.",
		deletionThisPhase: false,
		remainingGates: ["a real production consumer would be needed to promote beyond authoring-only"],
	},
	{
		id: "orchviz",
		purpose: "Orchestration visualization surface (removed).",
		status: "experimental",
		staticEvidence: "orchviz command REMOVED 2026-07 (superseded by mk:visual-plan + the local-web primitives); it was experimental with no production consumer.",
		runtimeEvidence: NO_RUNTIME,
		externalConsumerRisk: "low",
		confidence: "low",
		transitionBehavior: "Removed; the reusable loopback primitives were extracted to src/local-web/ and the studio to mk:visual-plan.",
		rollback: "Reintroduction is a separate product decision; Visual Plan must never depend on it.",
		verification: "removal verified: no orchviz imports remain; full suite green.",
		deletionThisPhase: false,
		remainingGates: ["code removed via the visual-plan plan; ledger entry retained for provenance"],
	},
	{
		id: "trace-index",
		purpose: "Opt-in derived SQLite index over the append logs (mewkit index/query).",
		status: "experimental",
		staticEvidence: "derived-index.ts builds a disposable index; logs stay canonical; dead-weight-audit-rules flags it a WATCH/prune candidate until a cross-run aggregate need is demonstrated.",
		runtimeEvidence: NO_RUNTIME,
		externalConsumerRisk: "low",
		confidence: "medium",
		transitionBehavior: "Keep experimental/opt-in; the index is rebuildable, so removal is always safe once disuse is shown.",
		rollback: "Rebuild the index from canonical logs.",
		verification: "index build unit-tested; no demonstrated cross-run aggregate consumer.",
		deletionThisPhase: false,
		remainingGates: ["demonstrate a real cross-run aggregate need OR confirm disuse before pruning"],
	},
	{
		id: "command-aliases",
		purpose: "Command aliases that may be pure forwarders to a canonical command.",
		status: "undecided",
		staticEvidence: "Aliases exist; behavior/snapshot equivalence not yet proven.",
		runtimeEvidence: NO_RUNTIME,
		externalConsumerRisk: "medium",
		confidence: "low",
		transitionBehavior: "Consolidate ONLY when behavior/snapshot equivalence proves an alias is a pure forwarder.",
		rollback: "Restore the alias.",
		verification: "no equivalence snapshot captured yet.",
		deletionThisPhase: false,
		remainingGates: ["capture behavior/snapshot equivalence proving a pure forwarder"],
	},
	{
		id: "state-stores",
		purpose: "task/checkpoint/progress state stores whose names overlap.",
		status: "undecided",
		staticEvidence: "Phase 4 task record + existing checkpoint/progress files coexist; name overlap is not proof of duplication.",
		runtimeEvidence: NO_RUNTIME,
		externalConsumerRisk: "medium",
		confidence: "low",
		transitionBehavior: "Reconcile ONLY where Phase-4 usage shows real duplication, not because names overlap.",
		rollback: "Keep the separate stores.",
		verification: "no duplication evidence from Phase-4 usage yet.",
		deletionThisPhase: false,
		remainingGates: ["Phase-4 usage evidence showing real duplication"],
	},
];

/** The ledger (stable order). */
export function getConsolidationLedger(): ConsolidationCandidate[] {
	return CONSOLIDATION_LEDGER;
}
