// Pure domain invariants. No IO. These are the security-bearing guards that
// every upper layer inherits: path-traversal rejection, provenance completeness,
// claim sourcing, and the state-transition machine.

import type { WikiClaim, WikiPage, WikiState, WikiOrigin } from "./types.js";

/** Reject any path segment that could escape the wiki root. Pure string check —
 * the caller passes a repo-relative path, never an absolute one. */
export function assertNoTraversal(path: string): void {
	if (path.length === 0) {
		throw new Error("path must be non-empty");
	}
	if (path.includes("\0")) {
		throw new Error(`path contains a null byte: ${JSON.stringify(path)}`);
	}
	if (path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path)) {
		throw new Error(`path must be repo-relative, got absolute: ${JSON.stringify(path)}`);
	}
	if (path.includes("\\")) {
		throw new Error(`path must use forward slashes: ${JSON.stringify(path)}`);
	}
	const segments = path.split("/");
	if (segments.some((segment) => segment === ".." || segment === ".")) {
		throw new Error(`path contains a traversal segment: ${JSON.stringify(path)}`);
	}
}

/** A canonical page must carry title, slug, created_at, updated_at, and a
 * provenance with a named origin (invariant). */
export function assertCanonicalComplete(page: WikiPage): void {
	const missing: string[] = [];
	if (!page.title) missing.push("title");
	if (!page.slug) missing.push("slug");
	if (!page.createdAt) missing.push("createdAt");
	if (!page.updatedAt) missing.push("updatedAt");
	if (!page.provenance || !page.provenance.origin) missing.push("provenance.origin");
	if (missing.length > 0) {
		throw new Error(`canonical page is missing required fields: ${missing.join(", ")}`);
	}
	assertNoTraversal(page.path);
}

/** A claim drawn from an external source must name that source. */
export function assertClaimHasSource(claim: WikiClaim): void {
	if (claim.external && !claim.sourceId) {
		throw new Error(`external claim ${JSON.stringify(claim.id)} requires a sourceId`);
	}
}

// --- State-transition machine ----------------------------------------------

const ALLOWED_TRANSITIONS: Record<WikiState, readonly WikiState[]> = {
	proposed: ["scanned", "quarantined", "rejected"],
	scanned: ["approved", "quarantined", "rejected"],
	approved: ["committed", "rejected"],
	committed: [],
	quarantined: [],
	rejected: [],
};

export interface TransitionContext {
	/** Origin of the content being transitioned. */
	origin: WikiOrigin;
}

export interface TransitionResult {
	ok: boolean;
	reason?: string;
}

/**
 * Decide whether a lifecycle transition is permitted. Two security invariants
 * are enforced structurally:
 *  - Only `scanned` content can reach `approved` (unscanned content is barred).
 *  - Agent-origin content can never reach `committed` (no self-commit).
 */
export function canTransition(
	from: WikiState,
	to: WikiState,
	ctx: TransitionContext,
): TransitionResult {
	if (from === to) {
		return { ok: false, reason: `no-op transition: ${from} → ${to}` };
	}
	if (!ALLOWED_TRANSITIONS[from].includes(to)) {
		return { ok: false, reason: `illegal transition: ${from} → ${to}` };
	}
	if (to === "committed" && ctx.origin === "agent") {
		return { ok: false, reason: "agent-origin content cannot transition to committed" };
	}
	return { ok: true };
}

/** Throwing wrapper around `canTransition` for call sites that treat an illegal
 * transition as a programming error. */
export function assertTransition(
	from: WikiState,
	to: WikiState,
	ctx: TransitionContext,
): void {
	const result = canTransition(from, to, ctx);
	if (!result.ok) {
		throw new Error(result.reason);
	}
}
