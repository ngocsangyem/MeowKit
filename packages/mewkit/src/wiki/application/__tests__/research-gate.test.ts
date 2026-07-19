// The research gate: runResearchStep refuses (before any fetch) when the injected verifier reports
// an inconsistent index, naming the remediation; when the index is fresh it proceeds to fetch.
import { describe, expect, it, vi } from "vitest";
import { runResearchStep, type ResearchContext } from "../research.js";
import type { WikiVerifyReport } from "../verify.js";

function report(fresh: boolean, overrides: Partial<WikiVerifyReport["sections"]> = {}): WikiVerifyReport {
	return {
		fresh,
		sections: {
			pages: { canonicalCount: 1, indexedCount: 1, ok: true, mismatches: [] },
			hashes: { checked: 1, mismatched: [], ok: true },
			provenance: { orphanedClaims: [], claimsMissingSource: [], ok: true },
			fts: { pageRows: 1, ftsRows: 1, ok: true },
			...overrides,
		},
		remediation: "wiki reindex",
	};
}

function ctx(over: Partial<ResearchContext>): ResearchContext {
	return {
		fetcher: { fetch: vi.fn(async () => ({ content: "doc", source: { id: "s1" }, sourceUrl: "https://x" })) } as never,
		index: { searchFts: () => [] },
		propose: () => ({ decision: { kind: "proposed" }, candidate: { id: "cand-1" } }) as never,
		appendSource: () => undefined,
		trace: () => undefined,
		...over,
	};
}

describe("runResearchStep — index-consistency gate", () => {
	it("refuses on an inconsistent index and never fetches", async () => {
		const fetch = vi.fn(async () => ({ content: "doc", source: { id: "s1" }, sourceUrl: "https://x" }));
		const c = ctx({
			fetcher: { fetch } as never,
			verify: () => report(false, { hashes: { checked: 1, mismatched: ["demo/one"], ok: false } }),
		});
		await expect(runResearchStep(c, "demo" as never, { kind: "web" } as never)).rejects.toThrow(
			/inconsistent \(hashes\).*wiki reindex/,
		);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("proceeds to fetch when the index is fresh", async () => {
		const fetch = vi.fn(async () => ({ content: "doc", source: { id: "s1" }, sourceUrl: "https://x" }));
		const c = ctx({ fetcher: { fetch } as never, verify: () => report(true) });
		await runResearchStep(c, "demo" as never, { kind: "web" } as never);
		expect(fetch).toHaveBeenCalledOnce();
	});

	it("proceeds when no verifier is wired (gate is optional/advisory)", async () => {
		const fetch = vi.fn(async () => ({ content: "doc", source: { id: "s1" }, sourceUrl: "https://x" }));
		const c = ctx({ fetcher: { fetch } as never }); // no verify
		await runResearchStep(c, "demo" as never, { kind: "web" } as never);
		expect(fetch).toHaveBeenCalledOnce();
	});
});
