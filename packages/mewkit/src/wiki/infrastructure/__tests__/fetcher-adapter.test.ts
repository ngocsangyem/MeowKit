import { describe, expect, it } from "vitest";
import { FetcherAdapter, type FetchImpl } from "../fetcher-adapter.js";
import type { WikiSeed } from "../../domain/index.js";

// Security tests for the external fetcher. The HTTP layer is injected (fetchImpl), so url-guard,
// per-hop redirect re-validation, and size cap are proven WITHOUT real network egress.

function reader(text: string) {
	const data = new TextEncoder().encode(text);
	let sent = false;
	return {
		getReader: () => ({
			read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: data })),
			cancel: async () => {},
		}),
	};
}

function makeResponse(opts: { status?: number; headers?: Record<string, string>; bodyText?: string }) {
	const status = opts.status ?? 200;
	const h = opts.headers ?? {};
	return {
		status,
		ok: status >= 200 && status < 300,
		headers: { get: (n: string) => h[n.toLowerCase()] ?? null },
		body: opts.bodyText !== undefined ? reader(opts.bodyText) : null,
		text: async () => opts.bodyText ?? "",
	};
}

const webSeed = (url: string): WikiSeed => ({ id: "s", query: url, kind: "web", status: "queued", createdAt: "t" });

describe("FetcherAdapter.buildUrl", () => {
	const f = new FetcherAdapter({ fetchImpl: async () => makeResponse({}) });
	it("maps each kind to a URL", () => {
		expect(f.buildUrl(webSeed("https://example.com/x"))).toBe("https://example.com/x");
		expect(f.buildUrl({ id: "s", query: "memory", kind: "arxiv", status: "queued", createdAt: "t" })).toContain(
			"export.arxiv.org",
		);
		expect(f.buildUrl({ id: "s", query: "repo", kind: "github", status: "queued", createdAt: "t" })).toContain(
			"api.github.com",
		);
		expect(() => f.buildUrl({ id: "s", query: "x", kind: "internal", status: "queued", createdAt: "t" })).toThrow();
	});
});

describe("FetcherAdapter SSRF + size guards", () => {
	it("blocks an unsafe start URL BEFORE any network call", async () => {
		let called = 0;
		const fetchImpl: FetchImpl = async () => {
			called++;
			return makeResponse({ bodyText: "x" });
		};
		const f = new FetcherAdapter({ fetchImpl });
		await expect(f.fetch(webSeed("http://169.254.169.254/meta"))).rejects.toThrow(/unsafe URL/);
		expect(called).toBe(0);
	});

	it("re-validates EVERY redirect hop — a redirect to a private host is blocked", async () => {
		const fetchImpl: FetchImpl = async (url) => {
			if (url.includes("example.com"))
				return makeResponse({ status: 302, headers: { location: "http://169.254.169.254/" } });
			return makeResponse({ bodyText: "should never reach here" });
		};
		const f = new FetcherAdapter({ fetchImpl });
		await expect(f.fetch(webSeed("https://example.com/start"))).rejects.toThrow(/unsafe URL/);
	});

	it("rejects via content-length size cap", async () => {
		const fetchImpl: FetchImpl = async () => makeResponse({ headers: { "content-length": "999999" }, bodyText: "big" });
		const f = new FetcherAdapter({ fetchImpl, maxBytes: 10 });
		await expect(f.fetch(webSeed("https://example.com/x"))).rejects.toThrow(/size cap/);
	});

	it("rejects via streaming size cap when content-length is absent", async () => {
		const fetchImpl: FetchImpl = async () => makeResponse({ bodyText: "x".repeat(50) });
		const f = new FetcherAdapter({ fetchImpl, maxBytes: 10 });
		await expect(f.fetch(webSeed("https://example.com/x"))).rejects.toThrow(/size cap/);
	});

	it("caps redirect hops", async () => {
		let n = 0;
		const fetchImpl: FetchImpl = async () =>
			makeResponse({ status: 302, headers: { location: "https://example.com/hop" + n++ } });
		const f = new FetcherAdapter({ fetchImpl, maxHops: 2 });
		await expect(f.fetch(webSeed("https://example.com/start"))).rejects.toThrow(/too many redirects/);
	});

	it("returns body text for a clean 200 response", async () => {
		const fetchImpl: FetchImpl = async () => makeResponse({ bodyText: "clean fetched content" });
		const f = new FetcherAdapter({ fetchImpl });
		const doc = await f.fetch(webSeed("https://example.com/x"));
		expect(doc.content).toBe("clean fetched content");
		expect(doc.source.url).toBe("https://example.com/x");
		expect(doc.source.contentHash).toBeDefined();
	});
});
