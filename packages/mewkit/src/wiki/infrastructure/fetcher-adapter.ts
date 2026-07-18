import { createHash } from "node:crypto";
import type { WikiSeed, WikiSource } from "../domain/index.js";
import type { Fetcher, FetchedDoc } from "../application/ports.js";
import { isSafeSourceUrl, MAX_CONTENT_BYTES } from "./scanner-adapter.js";

// External fetcher (web / arXiv / GitHub). EVERY fetched byte is DATA. Security per
// web-to-markdown Layer 2/3: url-guard BEFORE any read, manual redirects re-validated at
// EVERY hop (no auto-follow into a private host), size cap (content-length + streaming), and
// a timeout. The HTTP impl is injectable so the redirect/size guards are unit-testable
// without real network. This adapter never scans/scrubs — that is the ScannerAdapter's job,
// run inside proposeCandidate on the way to a candidate (fetched content is NEVER a page).

interface FetchResponse {
	status: number;
	ok: boolean;
	headers: { get(name: string): string | null };
	body: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel(): Promise<void> } } | null;
	text(): Promise<string>;
}
export type FetchImpl = (
	url: string,
	init: { redirect: "manual"; signal: unknown; headers: Record<string, string> },
) => Promise<FetchResponse>;

export interface FetcherOptions {
	fetchImpl?: FetchImpl;
	maxBytes?: number;
	maxHops?: number;
	timeoutMs?: number;
}

function sha16(s: string): string {
	return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

export class FetcherAdapter implements Fetcher {
	private readonly fetchImpl: FetchImpl;
	private readonly maxBytes: number;
	private readonly maxHops: number;
	private readonly timeoutMs: number;

	constructor(opts: FetcherOptions = {}) {
		// Builtin fetch is structurally compatible with FetchResponse (undici). Cast at the boundary.
		this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl);
		this.maxBytes = opts.maxBytes ?? MAX_CONTENT_BYTES;
		this.maxHops = opts.maxHops ?? 3;
		this.timeoutMs = opts.timeoutMs ?? 15000;
	}

	/** Map a seed to a fetch URL. Web seeds carry a URL; arXiv/GitHub map to their public APIs. */
	buildUrl(seed: WikiSeed): string {
		switch (seed.kind) {
			case "web":
				return seed.query;
			case "arxiv":
				return (
					"http://export.arxiv.org/api/query?search_query=all:" + encodeURIComponent(seed.query) + "&max_results=1"
				);
			case "github":
				return "https://api.github.com/search/repositories?q=" + encodeURIComponent(seed.query) + "&per_page=1";
			default:
				throw new Error("seed kind is not fetchable: " + seed.kind);
		}
	}

	async fetch(seed: WikiSeed): Promise<FetchedDoc> {
		const url = this.buildUrl(seed);
		const content = await this.safeGet(url);
		const source: WikiSource = {
			id: "src-" + sha16(url),
			kind: seed.kind,
			url,
			fetchedAt: new Date().toISOString(),
			contentHash: sha16(content),
		};
		return { content, sourceUrl: url, source };
	}

	/** url-guard at EVERY hop; manual redirects; size cap; timeout. */
	private async safeGet(startUrl: string): Promise<string> {
		let url = startUrl;
		for (let hop = 0; hop <= this.maxHops; hop++) {
			if (!isSafeSourceUrl(url)) throw new Error("blocked unsafe URL: " + url);
			const ctrl = new AbortController();
			const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
			let res: FetchResponse;
			try {
				res = await this.fetchImpl(url, {
					redirect: "manual",
					signal: ctrl.signal,
					headers: { "user-agent": "mewkit-wiki-research" },
				});
			} finally {
				clearTimeout(timer);
			}
			if (res.status >= 300 && res.status < 400) {
				const loc = res.headers.get("location");
				if (!loc) throw new Error("redirect without Location header");
				url = new URL(loc, url).toString(); // resolve relative; re-validated at loop top
				continue;
			}
			if (!res.ok) throw new Error("fetch failed: HTTP " + res.status);
			const cl = Number(res.headers.get("content-length") ?? "0");
			// Finite-guard: a non-numeric header coerces to NaN; the streaming cap is the real backstop.
			if (Number.isFinite(cl) && cl > this.maxBytes) throw new Error("size cap exceeded (content-length)");
			return await this.readCapped(res);
		}
		throw new Error("too many redirects (> " + this.maxHops + ")");
	}

	private async readCapped(res: FetchResponse): Promise<string> {
		// Fail closed on a body-less response — res.text() would read unbounded into memory with
		// no streaming cap. A normal GET 200 always exposes a readable body.
		if (!res.body) throw new Error("response has no readable body");
		const reader = res.body.getReader();
		const chunks: Uint8Array[] = [];
		let total = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) {
				total += value.length;
				if (total > this.maxBytes) {
					await reader.cancel();
					throw new Error("size cap exceeded during stream");
				}
				chunks.push(value);
			}
		}
		return Buffer.concat(chunks).toString("utf-8");
	}
}
