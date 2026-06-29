// Wiki domain types. Pure vocabulary — no IO, no fs, no DB, no network.
// Mirrors the pure-domain shape of repository-harness/crates/harness-cli/src/domain.rs.
// Type names track the domain model; salience component keys track the salience rubric.

// --- Branded primitives -----------------------------------------------------

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** A validated wiki slug: lowercase alphanumerics joined by single hyphens. */
export type WikiSlug = Brand<string, "WikiSlug">;
/** A stable wiki page identifier. */
export type WikiPageId = Brand<string, "WikiPageId">;

/** Slug grammar. The pattern forbids `.`, `/`, and whitespace, so a valid slug
 * can never carry a path-traversal sequence. */
export const WIKI_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isWikiSlug(value: string): value is WikiSlug {
	return WIKI_SLUG_PATTERN.test(value);
}

/** Smart constructor for a slug. Throws on invalid input — callers never
 * fabricate a branded slug by assertion. */
export function makeWikiSlug(value: string): WikiSlug {
	if (!isWikiSlug(value)) {
		throw new Error(`invalid wiki slug: ${JSON.stringify(value)}`);
	}
	return value as WikiSlug;
}

export function makeWikiPageId(value: string): WikiPageId {
	if (value.length === 0) {
		throw new Error("wiki page id must be non-empty");
	}
	return value as WikiPageId;
}

// --- Shared enums -----------------------------------------------------------

/** Who originated a piece of content. Agent-origin content can never self-commit. */
export type WikiOrigin = "agent" | "human" | "system";

/** Lifecycle state shared by candidates and pages. */
export type WikiState =
	| "proposed"
	| "scanned"
	| "approved"
	| "committed"
	| "quarantined"
	| "rejected";

export type WikiSourceKind = "web" | "arxiv" | "github" | "internal";

export type SeedStatus = "queued" | "fetched" | "done" | "failed";

export type VerificationState = "unverified" | "verified" | "rejected";

// --- Scanner verdict --------------------------------------------------------

export type ScanStatus = "clean" | "injection" | "secret";

/** Result of the multi-pass injection + secret scan. `status` carries the worst
 * finding; `clean` is the only status that may gate content toward `approved`. */
export interface InjectionVerdict {
	status: ScanStatus;
	/** Number of scan passes performed. */
	passes: number;
	findings: string[];
}

export function isClean(verdict: InjectionVerdict): boolean {
	return verdict.status === "clean";
}

// --- Salience ---------------------------------------------------------------

/** The 9 salience components. Keys are snake_case rubric identifiers
 * kept verbatim from the report so they map 1:1 to the wiki_salience store. */
export interface SalienceComponents {
	explicit_user_intent: number;
	verified_outcome: number;
	recurrence_or_friction: number;
	novelty_vs_existing_wiki: number;
	future_reuse_likelihood: number;
	source_quality: number;
	blast_radius: number;
	security_risk_penalty: number;
	staleness_penalty: number;
}

export interface SalienceScore {
	total: number;
	components: SalienceComponents;
}

// --- Content objects --------------------------------------------------------

export interface WikiSource {
	id: string;
	kind: WikiSourceKind;
	url: string;
	title?: string;
	fetchedAt: string;
	contentHash?: string;
}

export interface WikiClaim {
	id: string;
	text: string;
	/** True when the claim is drawn from an external source. */
	external: boolean;
	/** Required when `external` is true (invariant). */
	sourceId?: string;
	pageId?: WikiPageId;
}

export interface WikiSeed {
	id: string;
	query: string;
	kind: WikiSourceKind;
	status: SeedStatus;
	createdAt: string;
}

export interface WikiProvenance {
	origin: WikiOrigin;
	sourceIds: string[];
	/** The candidate this page was approved from, if any. */
	candidateId?: string;
	/** The human who approved the canonical write, if any. */
	approvedBy?: string;
}

export interface WikiCandidate {
	id: string;
	slug: WikiSlug;
	origin: WikiOrigin;
	title: string;
	content: string;
	whySave: string;
	evidence: string;
	sourceIds: string[];
	noveltyDelta: number;
	reuseScope: string;
	verificationState: VerificationState;
	riskScore: number;
	salience: SalienceScore;
	state: WikiState;
	createdAt: string;
	/** Review-after date or TTL marker. */
	reviewAfter?: string;
}

export interface WikiPage {
	id: WikiPageId;
	slug: WikiSlug;
	title: string;
	/** Repo-relative path under tasks/wikis/<slug>/pages/. */
	path: string;
	content: string;
	state: WikiState;
	createdAt: string;
	updatedAt: string;
	provenance: WikiProvenance;
	links: WikiPageId[];
}

export type InterventionKind = "reject" | "quarantine" | "override" | "link";

export interface WikiIntervention {
	id: string;
	kind: InterventionKind;
	candidateId?: string;
	reason: string;
	verdict?: InjectionVerdict;
	actor: WikiOrigin;
	createdAt: string;
}

// --- Write decision ---------------------------------------------------------

/** Outcome of `decideWrite`. By construction NONE of these writes a canonical
 * page — the strongest outcome is a candidate. Canonical pages are produced only
 * by the human-driven approve path in the application layer. */
export type WikiWriteDecision =
	| { kind: "quarantine"; reason: string }
	| { kind: "link-existing"; existingPageId: WikiPageId; reason: string }
	| { kind: "append-candidate"; reason: string }
	| { kind: "propose-candidate"; reason: string }
	| { kind: "discard"; reason: string };

/** Duplicate-check result fed to `decideWrite`. */
export interface DupCheck {
	isHighDuplicate: boolean;
	existingPageId?: WikiPageId;
}
