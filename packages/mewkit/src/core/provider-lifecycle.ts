// Per-provider LIFECYCLE-EVENT mappings (Phase 6). For each of the 9 portable lifecycle events,
// declare whether a provider fires it and — separately — whether a handler can GATE (deny/block)
// on it. Trusted adapter constants (like provider-projection.ts): they must never over-claim.
// `gate` is true ONLY where a runtime hook proof exists; a version-gated or observe-only event is
// `advisory`/`gate:false`, never asserted as enforceable. MeowKit records these facts; the host
// runs the hooks. Evidence strings cite the in-repo proof (shipped settings.json / the codex
// capability table) so a provider claim is auditable.

/** The 9 portable lifecycle events (host-neutral names). */
export const LIFECYCLE_EVENTS = [
	"session_start",
	"pre_tool",
	"post_tool",
	"tool_failure",
	"prompt_submitted",
	"stop",
	"pre_compaction",
	"subagent_start",
	"subagent_stop",
] as const;
export type LifecycleEvent = (typeof LIFECYCLE_EVENTS)[number];

export type LifecycleStatus = "supported" | "advisory" | "unsupported" | "unknown";

export interface LifecycleSupport {
	status: LifecycleStatus;
	/** True ONLY where a runtime hook can deny/block (proven). Observe-only or version-gated ⇒ false. */
	gate: boolean;
	/** In-repo basis for the claim — what proves the status/gate. Capability citations live HERE, never in `proof`. */
	evidence: string;
	/**
	 * Repo-relative path (optionally `path#marker`) to the in-repo artifact that DEMONSTRATES the
	 * deny/block emission. REQUIRED whenever `gate === true` — `assertGateProofs()` (and its test)
	 * fail closed if a gate lacks a proof whose file exists. A gate without a proof file is exactly
	 * the over-claim this field exists to prevent: it keeps "documented capability" (evidence prose)
	 * from ever passing as "proven enforcement" (a real artifact on disk).
	 */
	proof?: string;
}

export type LifecycleMap = Record<LifecycleEvent, LifecycleSupport>;

/** Claude Code: all 9 events are registered hooks in the shipped `.claude/settings.json`
 * (SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit, Stop, PreCompact,
 * SubagentStart, SubagentStop). Deny/block is PROVEN in-repo on PreToolUse (exit-2 integration
 * tests) and Stop (pre-completion-check security-BLOCK path + its shell test). UserPromptSubmit is
 * a documented HOST capability, but no shipped hook blocks there (the UserPromptSubmit handlers are
 * inject/capture only, `.claude/hooks/handlers.json`) — so `prompt_submitted` is `gate: false`: no
 * in-repo proof. Promotion path: add a blocking UserPromptSubmit handler + conformance test, then
 * flip `gate: true` with a `proof`. */
const CLAUDE_CODE_LIFECYCLE: LifecycleMap = {
	session_start: { status: "supported", gate: false, evidence: "SessionStart hook in shipped settings.json (observe/inject)" },
	pre_tool: { status: "supported", gate: true, evidence: "PreToolUse hook denies a tool call via exit 2 / permissionDecision:deny", proof: "src/__tests__/hooks/gate-enforcement.integration.test.ts" },
	post_tool: { status: "supported", gate: false, evidence: "PostToolUse hook in shipped settings.json (observe)" },
	tool_failure: { status: "supported", gate: false, evidence: "PostToolUseFailure hook in shipped settings.json (observe)" },
	prompt_submitted: { status: "supported", gate: false, evidence: "UserPromptSubmit block is a documented host capability, but no shipped hook blocks there (handlers are inject/capture only) — no in-repo proof" },
	stop: { status: "supported", gate: true, evidence: "Stop hook can block the stop (pre-completion-check security-BLOCK, exit 2)", proof: ".claude/hooks/__tests__/test-pre-completion-check.sh" },
	pre_compaction: { status: "supported", gate: false, evidence: "PreCompact hook in shipped settings.json (observe)" },
	subagent_start: { status: "supported", gate: false, evidence: "SubagentStart hook in shipped settings.json (observe)" },
	subagent_stop: { status: "supported", gate: false, evidence: "SubagentStop hook in shipped settings.json (observe)" },
};

/** Claude plugin: the same SessionStart-et-al hooks, propagated into the plugin payload by
 * `build-plugin` — identical lifecycle surface to the flat copy. */
const CLAUDE_PLUGIN_LIFECYCLE: LifecycleMap = {
	...CLAUDE_CODE_LIFECYCLE,
	session_start: { status: "supported", gate: false, evidence: "SessionStart hook propagated into the plugin payload by build-plugin (observe/inject)" },
};

/** Codex: per `migrate/providers/codex/capabilities.ts` CODEX_CAPABILITY_TABLE (v0.142). Codex
 * fires most events, and PreToolUse/PermissionRequest deny is documented — BUT enforcement is
 * version-gated (CODEX_MIN_SUPPORTED_VERSION 0.142). Statically we cannot prove the installed
 * version, so `gate` stays false here (advisory); a runtime `detectCodexCapabilities()` probe is
 * what would promote it. `tool_failure` has no codex event ⇒ unsupported. */
const CODEX_VERSION_NOTE = "codex hooks are version-gated (CODEX_MIN_SUPPORTED_VERSION 0.142); deny needs a runtime version probe";
const CODEX_LIFECYCLE: LifecycleMap = {
	session_start: { status: "supported", gate: false, evidence: "codex SessionStart (capability table 0.142)" },
	pre_tool: { status: "advisory", gate: false, evidence: `codex PreToolUse deny documented but ${CODEX_VERSION_NOTE}` },
	post_tool: { status: "supported", gate: false, evidence: "codex PostToolUse (capability table 0.142, observe)" },
	tool_failure: { status: "unsupported", gate: false, evidence: "codex exposes no tool-failure event" },
	prompt_submitted: { status: "supported", gate: false, evidence: "codex UserPromptSubmit (capability table 0.142)" },
	stop: { status: "supported", gate: false, evidence: "codex Stop (capability table 0.142, observe)" },
	pre_compaction: { status: "supported", gate: false, evidence: "codex PreCompact (capability table 0.142)" },
	subagent_start: { status: "supported", gate: false, evidence: "codex SubagentStart (capability table 0.142)" },
	subagent_stop: { status: "supported", gate: false, evidence: "codex SubagentStop (capability table 0.142)" },
};

const LIFECYCLE_BY_PROVIDER: Record<string, LifecycleMap> = {
	"claude-code": CLAUDE_CODE_LIFECYCLE,
	"claude-plugin": CLAUDE_PLUGIN_LIFECYCLE,
	codex: CODEX_LIFECYCLE,
};

/** An all-`unknown` lifecycle map for a provider with no tested projection (claims nothing). */
function unknownLifecycle(): LifecycleMap {
	const out = {} as LifecycleMap;
	for (const e of LIFECYCLE_EVENTS) out[e] = { status: "unknown", gate: false, evidence: "no tested lifecycle projection for this provider" };
	return out;
}

/** The lifecycle map for a provider, or an all-`unknown` report-only fallback. */
export function getLifecycleMap(provider: string): LifecycleMap {
	return LIFECYCLE_BY_PROVIDER[provider] ?? unknownLifecycle();
}

/** The events on which a provider can actually GATE (deny/block) — proven only. */
export function gatingEvents(provider: string): LifecycleEvent[] {
	const map = getLifecycleMap(provider);
	return LIFECYCLE_EVENTS.filter((e) => map[e].gate);
}

/** The deny-capable events that carry security/privacy enforcement: a hook here can BLOCK a
 * dangerous tool call, a risky prompt, or an unsafe stop (the gate-enforcement / privacy-block
 * class of safety hooks). */
export const SECURITY_ENFORCEMENT_EVENTS: readonly LifecycleEvent[] = ["pre_tool", "prompt_submitted", "stop"];

export interface EnforcementGap {
	event: LifecycleEvent;
	/** The event's lifecycle status on this provider (why the gate can't be guaranteed). */
	status: LifecycleStatus;
	reason: string;
}

/**
 * Security/privacy ENFORCEMENT GAPS: the safety-critical deny events (`SECURITY_ENFORCEMENT_EVENTS`)
 * that this provider CANNOT statically guarantee a block on (`gate:false`). An empty list means the
 * provider can enforce all of them. A non-empty list is the honest "this provider cannot guarantee
 * <safety hook> will block here" signal — surfaced prominently so a consumer never assumes a
 * privacy/gate-enforcement hook is enforced when it is only advisory.
 */
export function enforcementGaps(provider: string): EnforcementGap[] {
	const map = getLifecycleMap(provider);
	return SECURITY_ENFORCEMENT_EVENTS.filter((e) => !map[e].gate).map((e) => ({
		event: e,
		status: map[e].status,
		reason:
			map[e].status === "unsupported"
				? `no ${e} event — a safety hook here cannot run at all`
				: map[e].status === "unknown"
					? `${e} support unproven for this provider — enforcement cannot be assumed`
					: `${e} fires but cannot guarantee a block (${map[e].evidence})`,
	}));
}

/** A `gate: true` claim that lacks a `proof` artifact reference — the over-claim shape. */
export interface GateProofViolation {
	provider: string;
	event: LifecycleEvent;
	reason: string;
}

/**
 * The enforced-without-proof invariant: every `gate: true` lifecycle entry MUST declare a `proof`
 * (a repo-relative artifact path). Returns a violation per gate lacking one. This is the in-module
 * half of the check — it proves a proof is DECLARED; the accompanying test proves the referenced
 * file EXISTS and cites a real deny/block artifact (it holds the repo root). Together they keep a
 * "documented capability" from ever masquerading as "proven enforcement".
 */
export function gateProofViolationsInMap(provider: string, map: LifecycleMap): GateProofViolation[] {
	const out: GateProofViolation[] = [];
	for (const event of LIFECYCLE_EVENTS) {
		if (!map[event].gate) continue;
		const proof = map[event].proof;
		if (proof === undefined || proof.trim().length === 0) {
			out.push({ provider, event, reason: `gate:true without a proof artifact — declare proof or set gate:false` });
		}
	}
	return out;
}

export function gateProofViolations(providers: readonly string[]): GateProofViolation[] {
	return providers.flatMap((provider) => gateProofViolationsInMap(provider, getLifecycleMap(provider)));
}
