// Knowledge-recall contract. Wiki-owned types describing the bounded recall envelope
// that `capabilities resolve` composes for a selected capability. The CORE resolver
// (src/core/*) must never import this module — recall is attached at the command layer
// as an extended result type so the pure core keeps zero wiki knowledge.

import type { HostResolveResult } from "../../core/resolve-capabilities.js";

/** How eagerly the selected capability recalls prior knowledge. Mirrors the handoff
 * registry's `WikiHandoffClass` (required | conditional | none) — recall composes the
 * profile class directly, so the vocabularies are deliberately identical. */
export type RecallPolicy = "required" | "conditional" | "none";

/**
 * Outcome of a recall attempt. Six mutually-exclusive statuses, all fail-open:
 * - `not-required`   — policy `none`/unregistered; zero index access.
 * - `conditional`    — policy `conditional`; zero automatic query, carries a follow-up hint.
 * - `ready`          — required recall ran and matched ≥1 page (bounded hits attached).
 * - `empty`          — required recall ran, the index is present, nothing matched.
 * - `index-missing`  — required recall wanted the derived index but no index DB exists.
 * - `query-failed`   — required recall ran but the query itself errored.
 * None of these ever flips the selected capability to unavailable.
 */
export type RecallStatus = "not-required" | "conditional" | "ready" | "empty" | "index-missing" | "query-failed";

/** A single bounded recall hit — provenance + snippet only, never a page body. */
export interface RecallHit {
	title: string;
	/** Project-root-readable page path (e.g. "tasks/wikis/<slug>/pages/x.md"). */
	path: string;
	snippet: string;
	tokenEstimate: number;
}

/** Recall provenance the renderers surface. `wikiPageCount` and `conditionalHint`
 * are status-specific (see field docs) — absent otherwise. */
export interface RecallMetadata {
	policy: RecallPolicy;
	/** The capability id the recall was composed for. */
	source: string;
	/** The sanitized FTS query actually executed (empty string when no query ran). */
	query: string;
	maxPages: number;
	includeContent: boolean;
	/** Present ONLY on `empty`: total pages in the wiki, so a renderer can distinguish
	 * "wiki has zero pages" (0) from "pages exist but none matched" (>0). */
	wikiPageCount?: number;
	/** Present ONLY on `conditional`: a concrete follow-up signal for the agent
	 * (what kind of task warrants a manual `mewkit wiki context` probe). */
	conditionalHint?: string;
}

/** The bounded recall envelope attached to a selected resolve result. */
export interface KnowledgeRecall {
	status: RecallStatus;
	policy: RecallPolicy;
	hits: RecallHit[];
	metadata: RecallMetadata;
}

/** Default recall bound: at most this many snippets, never page bodies. Enforced in
 * the recall function, not trusted from callers. */
export const DEFAULT_RECALL_MAX_PAGES = 3;

/** Command-layer extended result: the pure `HostResolveResult` plus an optional recall
 * envelope. Declared wiki-side so `core/` never gains a wiki-typed field. */
export interface ResolveWithRecall extends HostResolveResult {
	knowledgeRecall?: KnowledgeRecall;
}
