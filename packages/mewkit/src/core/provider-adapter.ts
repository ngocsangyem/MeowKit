// The unified per-provider ADAPTER view (Phase 6): one object composing the facts that were
// built across earlier phases — discovery projection + 4 support levels (P3), repo-context
// read/search acquisition (P5), lifecycle-event mappings (P6) — plus the task-state storage
// boundary (P4). This is the single surface `mewkit providers` renders and a resolution cites.
// It composes trusted adapter constants; it introduces no new provider-native claim of its own.
import { getProjection, type ProviderProjection } from "./provider-projection.js";
import { getAcquisitionDescriptor, type AcquisitionDescriptor } from "./repo-context-adapter.js";
import { getLifecycleMap, gatingEvents, enforcementGaps, type LifecycleMap, type LifecycleEvent, type EnforcementGap } from "./provider-lifecycle.js";
import { getInvocationShapes, type InvocationShapeMap } from "./provider-invocation.js";

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
	/** Where durable task state lives for this provider. */
	storageBoundary: string;
}

/** Task-state storage boundary. Identical across providers by P4 decision #2: task records are the
 * CONSUMER PROJECT's state (`<cwd>/tasks/active`), never plugin-owned data — so a plugin install
 * does NOT relocate them to ${CLAUDE_PLUGIN_DATA}. */
const STORAGE_BOUNDARY = "consumer project <cwd>/tasks/active (cwd-keyed; not plugin-owned)";

/** Compose the full adapter view for a provider (report-only fallbacks compose cleanly). */
export function describeProvider(provider: string): ProviderAdapterView {
	const projection = getProjection(provider);
	return {
		provider,
		status: projection.status,
		projection,
		acquisition: getAcquisitionDescriptor(provider),
		lifecycle: getLifecycleMap(provider),
		gatingEvents: gatingEvents(provider),
		enforcementGaps: enforcementGaps(provider),
		invocation: getInvocationShapes(provider),
		storageBoundary: STORAGE_BOUNDARY,
	};
}

/** The providers with an authored (non-report-only) adapter, for matrix enumeration. */
export const ADAPTED_PROVIDERS = ["claude-code", "claude-plugin", "codex"] as const;
