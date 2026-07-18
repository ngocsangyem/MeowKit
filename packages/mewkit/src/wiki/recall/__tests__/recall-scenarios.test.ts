import { describe, expect, it, vi } from "vitest";
import { DEFAULT_RECALL_MAX_PAGES, type KnowledgeRecall, type RecallStatus } from "../contract.js";
import { recallForCapability, type RecallDeps } from "../recall-for-capability.js";
import type { WikiSearchHit } from "../../application/ports.js";

// Capability ids used below map to real handoff classes:
//   mk:cook        → required (lifecycle-run)
//   mk:docs-finder → conditional (external-spec)
//   wiki-recall    → unregistered → none default
const hit = (title: string): WikiSearchHit => ({
	pageId: "p1",
	slug: "demo",
	title,
	snippet: "snippet…",
	tokenEstimate: 42,
	path: "tasks/wikis/demo/pages/x.md",
});

// The knowledge-recall validation matrix. Contract-level invariants are asserted here;
// each behavioral scenario is owned by the phase that implements it (named below so
// nothing is dropped). Behavioral scenarios move from `it.todo` to real assertions in
// their owning phase's test file:
//   1-6, 7b → recall-for-capability.test.ts   (bounded recall function)
//   7, table → src/commands/__tests__/capabilities-resolve.test.ts (resolver composition)
//   8        → src/core/__tests__/availability.test.ts (CLI self-availability)
//   9, 10    → migrate projection tests (managed block + provider truth)

describe("knowledge-recall contract", () => {
	it("declares exactly the six-status union, all fail-open", () => {
		const statuses: RecallStatus[] = ["not-required", "conditional", "ready", "empty", "index-missing", "query-failed"];
		// A compile-time exhaustiveness guard: any added/removed status breaks this map.
		const failOpen: Record<RecallStatus, true> = {
			"not-required": true,
			conditional: true,
			ready: true,
			empty: true,
			"index-missing": true,
			"query-failed": true,
		};
		for (const s of statuses) expect(failOpen[s]).toBe(true);
	});

	it("bounds default recall to 3 snippets, bodies off", () => {
		expect(DEFAULT_RECALL_MAX_PAGES).toBe(3);
	});

	it("envelope shape carries policy, hits and metadata", () => {
		const envelope: KnowledgeRecall = {
			status: "not-required",
			policy: "none",
			hits: [],
			metadata: { policy: "none", source: "svc", query: "", maxPages: 3, includeContent: false },
		};
		expect(envelope.hits).toEqual([]);
		expect(envelope.metadata.includeContent).toBe(false);
	});
});

describe("recall validation scenarios — bounded recall function", () => {
	const dbFile = "/tmp/does-not-matter/wiki-index.db";

	it("1: required + matching page + ready index → ready, ≤3 hits", () => {
		const search = vi.fn(() => [hit("A"), hit("B"), hit("C"), hit("D")].slice(0, 4));
		const deps: RecallDeps = { dbFile, indexExists: () => true, search };
		const r = recallForCapability("mk:cook", "how do I cook", deps);
		expect(r.status).toBe("ready");
		expect(r.policy).toBe("required");
		expect(r.hits.length).toBeLessThanOrEqual(DEFAULT_RECALL_MAX_PAGES);
		expect(search).toHaveBeenCalledTimes(1);
		// bounds enforced by the function, not the caller
		expect(search).toHaveBeenCalledWith(dbFile, expect.any(String), DEFAULT_RECALL_MAX_PAGES, false);
	});

	it("2: required + no hits → empty (with wikiPageCount)", () => {
		const deps: RecallDeps = { dbFile, indexExists: () => true, search: () => [], countPages: () => 7 };
		const r = recallForCapability("mk:cook", "something unmatched", deps);
		expect(r.status).toBe("empty");
		expect(r.metadata.wikiPageCount).toBe(7);
		expect(r.hits).toEqual([]);
	});

	it("3: required + missing index → index-missing", () => {
		const search = vi.fn(() => []);
		const deps: RecallDeps = { dbFile, indexExists: () => false, search };
		const r = recallForCapability("mk:cook", "anything", deps);
		expect(r.status).toBe("index-missing");
		expect(search).not.toHaveBeenCalled();
	});

	it("4: required + query error → query-failed", () => {
		const deps: RecallDeps = {
			dbFile,
			indexExists: () => true,
			search: () => {
				throw new Error("db boom");
			},
		};
		const r = recallForCapability("mk:cook", "anything", deps);
		expect(r.status).toBe("query-failed");
		expect(r.hits).toEqual([]);
	});

	it("5: conditional profile → conditional, 0 queries, carries hint", () => {
		const search = vi.fn(() => []);
		const indexExists = vi.fn(() => true);
		const deps: RecallDeps = { dbFile, indexExists, search };
		const r = recallForCapability("mk:docs-finder", "read the spec", deps);
		expect(r.status).toBe("conditional");
		expect(r.policy).toBe("conditional");
		expect(r.metadata.conditionalHint).toBeTruthy();
		expect(search).not.toHaveBeenCalled();
		expect(indexExists).not.toHaveBeenCalled();
	});

	it("6: none/unregistered profile → not-required, 0 index access", () => {
		const search = vi.fn(() => []);
		const indexExists = vi.fn(() => true);
		const deps: RecallDeps = { dbFile, indexExists, search };
		const r = recallForCapability("wiki-recall", "recall knowledge", deps);
		expect(r.status).toBe("not-required");
		expect(r.policy).toBe("none");
		expect(search).not.toHaveBeenCalled();
		expect(indexExists).not.toHaveBeenCalled();
	});

	it("7b: punctuated natural-language intent → sanitized FTS query, never query-failed", () => {
		let received = "";
		const deps: RecallDeps = {
			dbFile,
			indexExists: () => true,
			search: (_db, q) => {
				received = q;
				return [hit("Login")];
			},
		};
		const r = recallForCapability("mk:cook", "fix bug: login fails (again)", deps);
		expect(r.status).toBe("ready");
		expect(received).toBe("fix bug login fails again");
		expect(received).not.toMatch(/[:()]/);
	});
});

// Full matrix ownership (all scenarios now have executable coverage):
//   1-6, 7b → this file (bounded recall function)
//   7 + selection table → compose.test.ts (attachRecall)
//   8 → src/core/__tests__/availability.test.ts (self-availability evidence)
//   9, 10 → migrate/__tests__/codex-bootstrap-recall-projection.test.ts
