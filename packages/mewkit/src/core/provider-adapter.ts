// The unified per-provider ADAPTER view (Phase 6): one object composing the facts that were
// built across earlier phases — discovery projection + 4 support levels (P3), repo-context
// read/search acquisition (P5), lifecycle-event mappings (P6) — plus the task-state storage
// boundary (P4). This is the single surface `mewkit providers` renders and a resolution cites.
// It composes trusted adapter constants; it introduces no new provider-native claim of its own.
import { getProjection, type ProviderProjection } from "./provider-projection.js";
import { getAcquisitionDescriptor, type AcquisitionDescriptor } from "./repo-context-adapter.js";
import { getLifecycleMap, gatingEvents, enforcementGaps, type LifecycleMap, type LifecycleEvent, type EnforcementGap, type LifecycleSupport } from "./provider-lifecycle.js";
import { getInvocationShapes, type InvocationShapeMap } from "./provider-invocation.js";
import { getOperationShapes, type OperationShapeMap } from "./provider-operations.js";

// ── Unified support vocabulary (Phase 1: provider truth unification) ─────────────────────────
// ONE enum set, shared by the adapter view, the migration support summary, and the migration
// report — so `mewkit providers <p>` and `--lifecycle` can never state contradictory support or
// enforcement again. Every consuming surface derives these from `describeProvider().summary`; no
// surface may re-declare its own enforcement/role constants.

/** A provider's capability support headline. `experimental` is reserved for the migration layer
 * (config-declared doc maturity); the adapter itself only projects capability, so it emits
 * `supported | partial | unsupported`. */
export type ProviderSupportState = "supported" | "partial" | "experimental" | "unsupported";

/** Per-gate enforcement level. `enforced` requires a PROVEN deny/block (a lifecycle gate); a surface
 * that only advises (prompt-level, version-gated, or observe-only) is `advisory`; absent ⇒ `unsupported`.
 * Replaces the legacy 4-value `hard | candidate | advisory | unsupported`: "candidate" was an
 * unproven aspiration and is exactly the over-claim MK-P0-01 flagged. */
export type SurfaceEnforcement = "enforced" | "advisory" | "unsupported";

export interface ProviderEnforcement {
	gate1: SurfaceEnforcement;
	gate2: SurfaceEnforcement;
	secretProtection: SurfaceEnforcement;
}

/** The canonical, capability-derived support headline for a provider. Both CLI views and the
 * migration summary render THIS — never a hand-written constant. */
export interface ProviderSummaryView {
	supportState: ProviderSupportState;
	enforcement: ProviderEnforcement;
	/** True when the provider proves a PreToolUse deny — the mechanism behind all three gates. */
	gatesProven: boolean;
}

export interface ProviderAdapterView {
	provider: string;
	/** Aggregate: `supported` (projection supported) · `partial` · `report-only` (no projection). */
	status: ProviderProjection["status"];
	/** Discovery projection + the four independent support levels (discoverable…enforceable). */
	projection: ProviderProjection;
	/** How the host acquires repo-context evidence (read/search tools). */
	acquisition: AcquisitionDescriptor;
	/** Per-lifecycle-event support + gate capability. */
	lifecycle: LifecycleMap;
	/** The events this provider can actually GATE on (proven deny/block) — may be empty. */
	gatingEvents: LifecycleEvent[];
	/** Security/privacy deny events this provider CANNOT guarantee a block on — may be empty. */
	enforcementGaps: EnforcementGap[];
	/** Logical invocation id → the provider-native operation shape (adapter-owned constants). */
	invocation: InvocationShapeMap;
	/** Logical workflow operation → its shape here. Distinct from `invocation`: these are named
	 * in skill PROSE and are deliberately NOT frontmatter-reachable (see provider-operations.ts). */
	operations: OperationShapeMap;
	/** Where durable task state lives for this provider. */
	storageBoundary: string;
	/** The canonical support/enforcement headline — the single source every other surface derives. */
	summary: ProviderSummaryView;
}

/** Enforcement level for one gate, derived from the PreToolUse lifecycle entry: a proven deny is
 * `enforced`; an event that fires but cannot guarantee a block is `advisory`; absent/unproven is
 * `unsupported`. All three gates rest on the same PreToolUse deny mechanism (source-write block,
 * ship block, privacy block), so they share this derivation. */
function enforcementFromPreTool(pre: LifecycleSupport): SurfaceEnforcement {
	if (pre.gate) return "enforced";
	if (pre.status === "supported" || pre.status === "advisory") return "advisory";
	return "unsupported";
}

/** Compose the capability-derived support headline from projection + lifecycle.
 * ASSUMPTION: all three gates derive from `pre_tool.gate` because every one of them is enforced via
 * PreToolUse deny in this repo (gate-enforcement / gate2-check / privacy-block). A future provider
 * that could block on `stop` but not `pre_tool` would under-claim here — revisit the derivation then. */
function deriveSummary(projection: ProviderProjection, lifecycle: LifecycleMap): ProviderSummaryView {
	const level = enforcementFromPreTool(lifecycle.pre_tool);
	const supportState: ProviderSupportState =
		projection.status === "supported" ? "supported" : projection.status === "partial" ? "partial" : "unsupported";
	return {
		supportState,
		enforcement: { gate1: level, gate2: level, secretProtection: level },
		gatesProven: lifecycle.pre_tool.gate,
	};
}

/** Task-state storage boundary. Identical across providers by P4 decision #2: task records are the
 * CONSUMER PROJECT's state (`<cwd>/tasks/active`), never plugin-owned data — so a plugin install
 * does NOT relocate them to ${CLAUDE_PLUGIN_DATA}. */
const STORAGE_BOUNDARY = "consumer project <cwd>/tasks/active (cwd-keyed; not plugin-owned)";

/** Compose the full adapter view for a provider (report-only fallbacks compose cleanly). */
export function describeProvider(provider: string): ProviderAdapterView {
	const projection = getProjection(provider);
	const lifecycle = getLifecycleMap(provider);
	return {
		provider,
		status: projection.status,
		projection,
		acquisition: getAcquisitionDescriptor(provider),
		lifecycle,
		gatingEvents: gatingEvents(provider),
		enforcementGaps: enforcementGaps(provider),
		invocation: getInvocationShapes(provider),
		operations: getOperationShapes(provider),
		storageBoundary: STORAGE_BOUNDARY,
		summary: deriveSummary(projection, lifecycle),
	};
}

/** The capability-derived support headline for a provider — the single source of truth the
 * migration summary and both CLI views consume. Thin wrapper over `describeProvider().summary`. */
export function providerSummary(provider: string): ProviderSummaryView {
	return describeProvider(provider).summary;
}

/** The providers with an authored (non-report-only) adapter, for matrix enumeration. */
export const ADAPTED_PROVIDERS = ["claude-code", "claude-plugin", "codex"] as const;
