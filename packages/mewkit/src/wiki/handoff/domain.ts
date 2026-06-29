// Handoff domain. Pure vocabulary + mapper — no IO, no fs, no DB, no network.
// A knowledge-producing skill describes its terminal artifact as a WikiHandoffPacket;
// `toProposeInput` maps that packet onto the existing application ProposeInput contract,
// so the handoff path reuses the single decideWrite/scoreSalience gate rather than
// re-implementing one. The packet is a SUPERSET of ProposeInput: it adds skill/artifact
// provenance that the gate does not need but the wiki_handoff store records.

import type {
	SalienceComponents,
	SalienceScore,
	VerificationState,
	WikiOrigin,
	WikiSlug,
	WikiWriteDecision,
} from "../domain/index.js";
import type { ProposeInput } from "../application/ports.js";

// --- Classes + profiles -----------------------------------------------------

/** How eagerly a skill hands knowledge off. `required` runs the advisory at the
 * end of every flow (still gated by salience); `conditional` only when the run
 * produced a project-specific artifact; `none` never auto-suggests. */
export type WikiHandoffClass = "required" | "conditional" | "none";

/** The knowledge family a skill's artifact belongs to. Drives default salience
 * emphasis. Adding a skill = adding a registry row, never editing a switch. */
export type WikiHandoffProfile =
	| "lifecycle-run"
	| "root-cause"
	| "review-verdict"
	| "planning-report"
	| "decision-record"
	| "security-posture"
	| "external-spec"
	| "architecture-analysis"
	| "workflow-recipe"
	| "project-convention";

/** Profile tag as stored — a concrete profile, or "none" for the default entry. */
export type WikiHandoffProfileTag = WikiHandoffProfile | "none";

/** Terminal state of a handoff attempt. */
export type WikiHandoffStatus = "suggested" | "proposed" | "skipped" | "quarantined";

// --- Artifact signal --------------------------------------------------------

/** Signals extracted from a skill's terminal artifact. The inputs to a profile's
 * `defaultSalience` / `shouldSuggest`. Deterministic — every time-dependent value
 * such as `producedAt` is passed in by the caller; the domain never reads the clock. */
export interface ArtifactSignal {
	skillName: string;
	/** Artifact location (provenance only here; path-gating happens in the service). */
	artifactPath: string;
	/** SHA-256 of the artifact content (computed by the service; provenance here). */
	artifactHash: string;
	/** Artifact size in bytes — a weak proxy for substance. */
	contentBytes: number;
	/** ISO timestamp the artifact was produced. Passed in; never Date.now() here. */
	producedAt: string;
	/** The user explicitly asked to capture/keep this knowledge. */
	explicitUserIntent?: boolean;
	/** A verified outcome backs the artifact: accepted verdict, green tests, shipped fix. */
	verifiedOutcome?: boolean;
	/** Addresses a recurring problem/friction (observed at least twice). */
	recurringFriction?: boolean;
	/** Caller-supplied novelty vs the existing wiki (0..2); profile default otherwise. */
	noveltyDelta?: number;
	/** Caller-supplied security-risk penalty (<= 0). */
	securityRiskPenalty?: number;
	/** Caller-supplied staleness penalty (<= 0). */
	stalenessPenalty?: number;
}

// --- Packet + record --------------------------------------------------------

/** A skill's knowledge handoff. Superset of ProposeInput: the extra fields are
 * provenance the wiki_handoff store records; the rest map onto ProposeInput. */
export interface WikiHandoffPacket {
	slug: WikiSlug;
	skillName: string;
	skillOwner?: string;
	handoffClass: WikiHandoffClass;
	profile: WikiHandoffProfileTag;
	artifactPath: string;
	artifactHash: string;
	title: string;
	content: string;
	origin: WikiOrigin;
	whySave: string;
	evidence: string;
	sourceIds: string[];
	reuseScope: string;
	verificationState: VerificationState;
	riskScore: number;
	noveltyDelta: number;
	salience: SalienceComponents;
	createdAt: string;
	reviewAfter?: string;
}

/** The append-only outcome record written to handoffs.jsonl and ingested into
 * wiki_handoff. It captures the decision (and candidate id, if one was created)
 * — NEVER raw artifact content. */
export interface WikiHandoffRecord {
	id: string;
	slug: WikiSlug;
	skillName: string;
	skillOwner?: string;
	handoffClass: WikiHandoffClass;
	profile: WikiHandoffProfileTag;
	artifactPath: string;
	artifactHash: string;
	title: string;
	whySave: string;
	evidence: string;
	reuseScope: string;
	verificationState: VerificationState;
	riskScore: number;
	salience: SalienceScore;
	decisionKind: WikiWriteDecision["kind"] | "skipped";
	candidateId?: string;
	pageId?: string;
	status: WikiHandoffStatus;
	createdAt: string;
	reviewAfter?: string;
}

// --- Profile contract -------------------------------------------------------

/** One row in the per-skill registry. `defaultSalience` and `shouldSuggest` are
 * pure functions of an ArtifactSignal — the salience GATE itself stays single-
 * sourced in the domain (scoreSalience + SALIENCE_THRESHOLDS); a profile only
 * supplies default component values, never new threshold logic. */
export interface SkillHandoffProfile {
	skillName: string;
	handoffClass: WikiHandoffClass;
	profile: WikiHandoffProfileTag;
	defaultReuseScope: string;
	artifactPatterns: string[];
	defaultSalience(signal: ArtifactSignal): SalienceComponents;
	shouldSuggest(signal: ArtifactSignal): boolean;
}

// Construction helpers (salienceComponents / makeSkillProfile / defineGroup /
// defaultShouldSuggest / ProfileSpec) live in `profile-factory.ts` so this file stays
// pure type vocabulary + the mapper.

// --- Mapper -----------------------------------------------------------------

/** Map a handoff packet onto the application ProposeInput contract. The provenance-
 * only fields (skill, profile, artifact hash) are dropped — they live in wiki_handoff,
 * not in the candidate. The result is assignable to ProposeInput by construction. */
export function toProposeInput(packet: WikiHandoffPacket): ProposeInput {
	return {
		slug: packet.slug,
		title: packet.title,
		content: packet.content,
		origin: packet.origin,
		whySave: packet.whySave,
		evidence: packet.evidence,
		sourceIds: packet.sourceIds,
		salience: packet.salience,
		noveltyDelta: packet.noveltyDelta,
		reuseScope: packet.reuseScope,
		verificationState: packet.verificationState,
		riskScore: packet.riskScore,
		reviewAfter: packet.reviewAfter,
	};
}
