// Hexagonal ports: domain-facing interfaces the infrastructure adapters
// implement and the application service depends on. No concrete IO here.

import type {
	DupCheck,
	InjectionVerdict,
	SalienceComponents,
	VerificationState,
	WikiCandidate,
	WikiIntervention,
	WikiOrigin,
	WikiPage,
	WikiSeed,
	WikiSlug,
	WikiSource,
	WikiWriteDecision,
} from "../domain/index.js";
import { MIN_SCAN_PASSES } from "../domain/index.js";

export interface ScanInput {
	content: string;
	origin: WikiOrigin;
	/** Present when the draft came from a fetched source; the scanner URL-guards it. */
	sourceUrl?: string;
}

export interface ScanOutput {
	verdict: InjectionVerdict;
	/** Content with secrets scrubbed — the only form that may ever be persisted. */
	scrubbed: string;
	secretsFound: boolean;
}

/**
 * The write-authorization token. Its constructor is private, so the ONLY way to obtain
 * an instance is `ApprovedWrite.issue(...)`, which throws unless the verdict is clean and
 * adequately scanned. `WikiRepository.writePage` accepts ONLY this type — a raw string or
 * a plain object will not type-check — so the canonical-write chokepoint is enforced by
 * the type system, not by lint.
 */
export class ApprovedWrite {
	private constructor(
		readonly page: WikiPage,
		readonly verdict: InjectionVerdict,
	) {}

	/** Mint a token from a scan result. Throws unless the verdict is clean AND meets the
	 * multi-pass floor. The token is bound to the scanner's SCRUBBED content —
	 * the page that gets persisted always carries `scan.scrubbed`, never caller-supplied
	 * raw content — so a secret/injection cannot ride into a canonical page via a valid
	 * token. This is the single gate between scanning and canonical writing. */
	static issue(page: WikiPage, scan: ScanOutput): ApprovedWrite {
		if (scan.verdict.status !== "clean") {
			throw new Error(`cannot authorize write: scan verdict is ${scan.verdict.status}`);
		}
		if (scan.verdict.passes < MIN_SCAN_PASSES) {
			throw new Error(`cannot authorize write: only ${scan.verdict.passes} scan pass(es) (< ${MIN_SCAN_PASSES})`);
		}
		return new ApprovedWrite({ ...page, content: scan.scrubbed }, scan.verdict);
	}
}

export interface Scanner {
	/** Run the full gate (URL-guard → size cap → normalize → multi-pass injection scan →
	 * secret scrub) and return a verdict plus the scrubbed content. */
	scan(input: ScanInput): ScanOutput;
}

export interface WikiRepository {
	createWiki(slug: WikiSlug, title: string): void;
	/** Canonical page write — accepts ONLY a scanner-issued token. */
	writePage(token: ApprovedWrite): void;
	readPage(slug: WikiSlug, file: string): WikiPage | null;
	listPages(slug: WikiSlug): string[];
	/** Park rejected/injected content in a read-blocked .quarantined file; returns its path. */
	quarantine(slug: WikiSlug, content: string, verdict: InjectionVerdict): string;
	// Append-only canonical sidecar stores (JSONL). None of these is a canonical page.
	appendCandidate(candidate: WikiCandidate): void;
	appendIntervention(slug: WikiSlug, intervention: WikiIntervention): void;
	appendSeed(slug: WikiSlug, seed: WikiSeed): void;
	appendSource(slug: WikiSlug, source: WikiSource): void;
	listCandidates(slug: WikiSlug): WikiCandidate[];
	getCandidate(slug: WikiSlug, id: string): WikiCandidate | null;
}

/** A document returned by the fetcher. Stubbed here so this layer type-checks
 * standalone; the concrete FetcherAdapter and runResearchStep wiring land with the research loop. */
export interface FetchedDoc {
	content: string;
	sourceUrl: string;
	source: WikiSource;
}

export interface Fetcher {
	fetch(seed: WikiSeed): Promise<FetchedDoc>;
}

export interface WikiSearchHit {
	pageId: string;
	slug: string;
	title: string;
	snippet: string;
	tokenEstimate: number;
	/** DB slug-relative page path (e.g. "pages/backend-infra.md"). Populated by the
	 * query layer; optional so synthetic hits (tests/mocks) need not supply it. */
	pagePath?: string;
	/** Project-root-readable path composed from the slug + pagePath
	 * (e.g. "tasks/wikis/<slug>/pages/backend-infra.md"). The agent-facing file target. */
	path?: string;
	/** Full page body — present only when the caller explicitly opts in (context --include-content). */
	content?: string;
}

export interface WikiIndex {
	upsertPage(page: WikiPage): void;
	searchFts(query: string, limit?: number): WikiSearchHit[];
}

export interface Tracer {
	recordWikiTrace(event: string, data: Record<string, unknown>): void;
}

export interface InventoryRegistrar {
	register(artifactPath: string, meta?: { criticality?: string; status?: string }): void;
}

// --- Application-service contract (consumed by service.ts; co-located here as the layer boundary) ---

export interface WikiServiceDeps {
	repo: WikiRepository;
	scanner: Scanner;
	index: WikiIndex;
	tracer: Tracer;
	/** Optional — present only when the research loop is enabled. */
	fetcher?: Fetcher;
	/** Optional index-consistency check; when present, research refuses on an inconsistent index. */
	verifier?: WikiVerifier;
}

/** A read-only wiki index-consistency check (see application/verify.ts). */
export type WikiVerifier = () => import("./verify.js").WikiVerifyReport;

export interface ProposeInput {
	slug: WikiSlug;
	title: string;
	content: string;
	origin: WikiOrigin;
	whySave: string;
	evidence: string;
	sourceIds: string[];
	salience: SalienceComponents;
	noveltyDelta?: number;
	reuseScope?: string;
	verificationState?: VerificationState;
	riskScore?: number;
	reviewAfter?: string;
	sourceUrl?: string;
	dup?: DupCheck;
}

export interface ProposeResult {
	decision: WikiWriteDecision;
	candidate?: WikiCandidate;
}
