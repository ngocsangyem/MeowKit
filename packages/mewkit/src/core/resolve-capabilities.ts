// Deterministic capability resolver. Given an intent phrase and a provider, score and
// rank candidates by term overlap and return the ranked list WITH the reason for each —
// it never auto-picks. Runtime invocability is NOT decided here: that needs Phase 3's
// host availability snapshot, so every candidate reports `invocable: "pending-host-snapshot"`.
// Pure and free of time/randomness so results are reproducible.
import type {
	CapabilityEntry,
	ContextRequirement,
	SupportLevels,
	TypedRequirement,
	Verification,
} from "./capability.js";
import {
	computeAvailability,
	rollUpInvocability,
	type AvailabilityContext,
	type AvailabilitySnapshot,
	type AvailabilityStatus,
} from "./availability.js";
import { getAcquisitionDescriptor, type AcquisitionDescriptor } from "./repo-context-adapter.js";
import { getProjection } from "./provider-projection.js";
import { gatingEvents, type LifecycleEvent } from "./provider-lifecycle.js";

// Field-class weights. A query term is credited ONCE at its highest-matching class
// (never summed across a capability's many keyword strings — that inflates keyword-heavy
// capabilities). Authored (curated flagship) intents outweigh inferred keywords so a
// flagship phrase cannot be out-ranked by incidental keyword overlap.
const WEIGHT_AUTHORED_INTENT = 6;
const WEIGHT_INFERRED_INTENT = 3;
const WEIGHT_ALIAS = 2;
const WEIGHT_TEXT = 1;
/** A top-two gap strictly below this ⇒ ambiguous (integer scores, so this flags 0- and
 * 1-point near-ties as ambiguous while an authored-vs-inferred win of ≥3 stays confident). */
const AMBIGUITY_EPSILON = 2;

export interface ResolvedCandidate {
	id: string;
	kind: string;
	score: number;
	reason: string;
	/** Static per-provider support, or null when that provider has no recorded evidence. */
	support: SupportLevels | null;
	requirements: TypedRequirement[];
	/** Set when the candidate must acquire a task-scoped repo-context envelope before
	 * source-grounded work (Phase 5). The orchestrator — not this pure resolver — acquires it. */
	contextRequirement: ContextRequirement | null;
	verification: Verification;
	/** Runtime invocability is deferred to Phase 3's host snapshot — never asserted here. */
	invocable: "pending-host-snapshot";
}

export interface ResolveResult {
	intent: string;
	provider: string | null;
	candidates: ResolvedCandidate[];
	/** True when no candidate matched OR the top two are within the near-tie threshold. */
	ambiguous: boolean;
}

const STOPWORDS = new Set([
	"the",
	"a",
	"an",
	"to",
	"of",
	"in",
	"on",
	"this",
	"that",
	"for",
	"and",
	"or",
	"my",
	"me",
	"it",
]);

/** Normalize free text to a set of lowercase terms (drop punctuation, stopwords, 1-char). */
function terms(text: string): Set<string> {
	return new Set(
		text
			.toLowerCase()
			.split(/[^a-z0-9]+/)
			.filter((t) => t.length > 1 && !STOPWORDS.has(t)),
	);
}

/** Union of terms across many field strings (deduped) — the set a query term can match. */
function fieldTerms(strings: string[]): Set<string> {
	const out = new Set<string>();
	for (const s of strings) for (const t of terms(s)) out.add(t);
	return out;
}

/**
 * Resolve an intent to ranked candidates. Each query term is credited ONCE at its
 * highest-matching field class (intent > alias > description) — no per-keyword summation,
 * so keyword multiplicity cannot inflate a score. Authored intents weigh more than
 * inferred keywords. Order: score desc, then id asc (stable). Zero-score candidates are
 * dropped; if none remain the result is `ambiguous` with an empty list.
 */
export function resolveCapabilities(
	entries: CapabilityEntry[],
	intent: string,
	provider: string | null = null,
): ResolveResult {
	const query = terms(intent);

	const scored = entries
		.map((e) => {
			const intentSet = fieldTerms(e.intents);
			const aliasSet = fieldTerms(e.aliases);
			const textSet = fieldTerms([e.whenToUse ?? "", e.description]);
			const intentWeight = e.provenance.intents === "authored" ? WEIGHT_AUTHORED_INTENT : WEIGHT_INFERRED_INTENT;

			let intentHits = 0,
				aliasHits = 0,
				textHits = 0;
			for (const q of query) {
				if (intentSet.has(q)) intentHits++;
				else if (aliasSet.has(q)) aliasHits++;
				else if (textSet.has(q)) textHits++;
			}
			const score = intentHits * intentWeight + aliasHits * WEIGHT_ALIAS + textHits * WEIGHT_TEXT;
			const parts: string[] = [];
			if (intentHits)
				parts.push(`${intentHits} ${e.provenance.intents === "authored" ? "authored " : ""}intent term(s)`);
			if (aliasHits) parts.push(`${aliasHits} alias term(s)`);
			if (textHits) parts.push(`${textHits} description term(s)`);
			return { e, score, reason: parts.length ? `matched ${parts.join(", ")}` : "no term overlap" };
		})
		.filter((c) => c.score > 0)
		.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.e.id < b.e.id ? -1 : 1));

	const candidates: ResolvedCandidate[] = scored.map(({ e, score, reason }) => ({
		id: e.id,
		kind: e.kind,
		score,
		reason,
		support: provider ? (e.support[provider] ?? null) : null,
		requirements: e.requirements,
		contextRequirement: e.contextRequirement,
		verification: e.verification,
		invocable: "pending-host-snapshot",
	}));

	const ambiguous =
		candidates.length === 0 ||
		(candidates.length >= 2 && candidates[0].score - candidates[1].score < AMBIGUITY_EPSILON);

	return { intent, provider, candidates, ambiguous };
}

/** A resolved candidate enriched with this host's real availability (Phase 3). */
export interface HostResolvedCandidate extends Omit<ResolvedCandidate, "invocable"> {
	availability: AvailabilitySnapshot[];
	/** Rolled-up host invocability — replaces the at-rest `pending-host-snapshot`. */
	invocable: AvailabilityStatus;
}

export interface HostResolveResult {
	intent: string;
	provider: string;
	ambiguous: boolean;
	/** Selection outcome. `not_needed` is an agent-side decision, never emitted here. */
	status: "selected" | "ambiguous" | "unavailable" | "unsupported";
	candidates: HostResolvedCandidate[];
	/** How THIS provider acquires repo-context evidence (Phase 5 slice 3). Actionable only when
	 * the selected candidate carries a `contextRequirement`; the orchestrator — not MeowKit —
	 * runs the named read/search tools and records the envelope via `context record`. */
	acquisition: AcquisitionDescriptor;
	/** Self-auditing provenance (Phase 6 slice 2): which adapter + evidence justified the provider
	 * claims in this result, and the events this provider can actually gate on. */
	adapterCitation: {
		provider: string;
		projectionStatus: string;
		projectionEvidence: string;
		gatingEvents: LifecycleEvent[];
	};
}

/**
 * Resolve an intent AND check this host's real availability for each candidate. Selection
 * (score-based) and invocability (availability-based) are surfaced SEPARATELY per the
 * four-levels model: each candidate keeps its own `invocable` verdict, while the top-level
 * `status` is the aggregate envelope outcome (which does fold in the top candidate's
 * invocability and support). A provider that does not support the top candidate's surface
 * → `unsupported`; a top candidate whose requirements are hard-blocked → `unavailable`.
 */
export function resolveWithHost(
	entries: CapabilityEntry[],
	intent: string,
	ctx: AvailabilityContext,
): HostResolveResult {
	const byId = new Map(entries.map((e) => [e.id, e]));
	const base = resolveCapabilities(entries, intent, ctx.provider);

	const candidates: HostResolvedCandidate[] = base.candidates.map((c) => {
		const entry = byId.get(c.id);
		const availability = entry ? computeAvailability(entry, ctx) : [];
		// Spread-override the at-rest `pending-host-snapshot` invocable with the host verdict.
		return { ...c, availability, invocable: rollUpInvocability(availability) };
	});

	let status: HostResolveResult["status"];
	if (candidates.length === 0) status = "unavailable";
	else if (base.ambiguous) status = "ambiguous";
	else if (candidates[0].support && candidates[0].support.discoverable === false) status = "unsupported";
	else status = candidates[0].invocable === "unavailable" ? "unavailable" : "selected";

	return {
		intent: base.intent,
		provider: ctx.provider,
		ambiguous: base.ambiguous,
		status,
		candidates,
		acquisition: getAcquisitionDescriptor(ctx.provider),
		adapterCitation: {
			provider: ctx.provider,
			projectionStatus: getProjection(ctx.provider).status,
			projectionEvidence: getProjection(ctx.provider).evidence,
			gatingEvents: gatingEvents(ctx.provider),
		},
	};
}
