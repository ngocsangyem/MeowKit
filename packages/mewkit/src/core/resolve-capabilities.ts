// Deterministic capability resolver. Given an intent phrase and a provider, score and
// rank candidates by term overlap and return the ranked list WITH the reason for each —
// it never auto-picks. Runtime invocability is NOT decided here: that needs Phase 3's
// host availability snapshot, so every candidate reports `invocable: "pending-host-snapshot"`.
// Pure and free of time/randomness so results are reproducible.
import type { CapabilityEntry, SupportLevels, TypedRequirement, Verification } from "./capability.js";

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

const STOPWORDS = new Set(["the", "a", "an", "to", "of", "in", "on", "this", "that", "for", "and", "or", "my", "me", "it"]);

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
export function resolveCapabilities(entries: CapabilityEntry[], intent: string, provider: string | null = null): ResolveResult {
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
			if (intentHits) parts.push(`${intentHits} ${e.provenance.intents === "authored" ? "authored " : ""}intent term(s)`);
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
		support: provider ? e.support[provider] ?? null : null,
		requirements: e.requirements,
		verification: e.verification,
		invocable: "pending-host-snapshot",
	}));

	const ambiguous =
		candidates.length === 0 ||
		(candidates.length >= 2 && candidates[0].score - candidates[1].score < AMBIGUITY_EPSILON);

	return { intent, provider, candidates, ambiguous };
}
