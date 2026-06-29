import type { InjectionVerdict } from "../domain/index.js";
import type { Scanner, ScanInput, ScanOutput } from "../application/ports.js";
import { normalizeForScan, scrubSecrets, validateContent } from "./scan-patterns.js";

// The security gate (web-to-markdown layers): URL-guard → size cap → normalize
// → multi-pass injection scan (plaintext + base64 + ROT13 + percent-decode) → flood check
// → secret scrub. Detection only — quarantine IO and the write-token mint happen in the
// repository/application so this stays pure and unit-testable. External + agent content is DATA.
// Carry-forward to the fetcher re-audit: hex IP encodings, redirect re-validation, and
// full web-to-markdown Layer-5 pattern parity (this layer has no live network egress yet).

/** Wiki draft size ceiling (bytes). Smaller than the 10MB web-fetch cap — a single page draft. */
export const MAX_CONTENT_BYTES = 1_000_000;

/** Scan passes performed on clean content — satisfies the domain MIN_SCAN_PASSES floor. */
const SCAN_PASSES = 4;

const BLOCKED_V4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|198\.1[89]\.)/;

function isBlockedIpv4(host: string): boolean {
	if (/^0x/i.test(host)) return true; // hex IP encoding (e.g. 0x7f000001) — no legit host starts 0x
	if (/^\d+$/.test(host)) return true; // bare-decimal IP encoding (e.g. 2130706433 = 127.0.0.1)
	if (/^0[0-9.]/.test(host)) return true; // octal leading-zero encoding (e.g. 0177.0.0.1)
	if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host === "0.0.0.0" || BLOCKED_V4.test(host);
	return false;
}

function isBlockedIpv6(addr: string): boolean {
	const a = addr.toLowerCase();
	if (a === "::1") return true; // loopback
	if (a.startsWith("fe80:")) return true; // link-local
	if (/^f[cd][0-9a-f]{0,2}:/.test(a)) return true; // ULA fc00::/7 (colon-anchored — no longer matches fcc.com)
	// IPv4-mapped, dotted form: ::ffff:169.254.169.254
	const dotted = a.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
	if (dotted) return isBlockedIpv4(dotted[1]);
	// IPv4-mapped, hex-compressed form the URL parser emits: ::ffff:a9fe:a9fe
	const hex = a.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
	if (hex) {
		const hi = parseInt(hex[1], 16);
		const lo = parseInt(hex[2], 16);
		const v4 = ((hi >> 8) & 0xff) + "." + (hi & 0xff) + "." + ((lo >> 8) & 0xff) + "." + (lo & 0xff);
		return isBlockedIpv4(v4);
	}
	return false;
}

/** Port of web-to-markdown Layer 2 `_safe_url`: http(s) only, no credentials-in-URL, no
 * private/loopback/link-local/metadata hosts (IPv4, IPv6, IPv4-mapped, bare-decimal, octal). */
export function isSafeSourceUrl(raw: string): boolean {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return false;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return false;
	if (url.username || url.password) return false;
	const host = url.hostname.toLowerCase();
	if (host.startsWith("[") && host.endsWith("]")) return !isBlockedIpv6(host.slice(1, -1));
	if (host === "localhost" || host.endsWith(".localhost")) return false;
	if (host === "metadata.google.internal" || /^metadata\./.test(host)) return false;
	return !isBlockedIpv4(host);
}

function rot13(text: string): string {
	return text.replace(/[a-zA-Z]/g, (c) => {
		const base = c <= "Z" ? 65 : 97;
		return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
	});
}

function percentDecode(text: string): string {
	try {
		return decodeURIComponent(text);
	} catch {
		return text; // malformed %-sequence — scan the raw form instead
	}
}

/** Extract HTML-comment bodies so injection hidden in <!-- ... --> is scanned, not skipped. */
function extractHtmlComments(text: string): string[] {
	return [...text.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1]);
}

/** Decode base64 blocks (≥16 chars catches short payloads) and return decoded strings to re-scan. */
function decodeBase64Blocks(text: string): string[] {
	const out: string[] = [];
	for (const m of text.matchAll(/[A-Za-z0-9+/]{16,}={0,2}/g)) {
		try {
			const decoded = Buffer.from(m[0], "base64").toString("utf-8");
			if (decoded && /[ -~]/.test(decoded)) out.push(decoded);
		} catch {
			// not valid base64 — ignore
		}
	}
	return out;
}

/** Context-flooding heuristic (injection-rules R9): large + highly repetitive content. */
function isFlood(text: string): boolean {
	if (text.length <= 5000) return false;
	const lines = text.split("\n");
	if (lines.length >= 10) return 1 - new Set(lines).size / lines.length > 0.3;
	return new Set(text).size / text.length < 0.05;
}

function findInjection(passes: string[]): string[] {
	const findings: string[] = [];
	for (const text of passes) {
		const result = validateContent(text);
		if (!result.valid && result.pattern) findings.push(result.pattern);
	}
	return findings;
}

export class ScannerAdapter implements Scanner {
	scan(input: ScanInput): ScanOutput {
		const fail = (finding: string): ScanOutput => ({
			verdict: { status: "injection", passes: SCAN_PASSES, findings: [finding] },
			scrubbed: "",
			secretsFound: false,
		});

		if (input.sourceUrl && !isSafeSourceUrl(input.sourceUrl)) return fail("unsafe-source-url");
		if (Buffer.byteLength(input.content, "utf-8") > MAX_CONTENT_BYTES) return fail("size-cap-exceeded");

		const normalized = normalizeForScan(input.content);
		const findings = findInjection([
			normalized,
			percentDecode(normalized),
			rot13(normalized),
			...decodeBase64Blocks(normalized),
			...extractHtmlComments(normalized),
		]);
		if (isFlood(normalized)) findings.push("context-flood");
		const status = findings.length > 0 ? "injection" : "clean";

		const scrubbed = scrubSecrets(normalized);
		const verdict: InjectionVerdict = { status, passes: SCAN_PASSES, findings };
		return { verdict, scrubbed, secretsFound: scrubbed !== normalized };
	}
}
