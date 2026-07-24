// `mewkit memory capture` core: detect a `##pattern` / `##decision` / `##note`
// prefix in a prompt and route the content to the right `.meowkit/memory` store
// through the sanctioned write path. Curated stores go through the Phase-1 write
// contract (validate → scrub → scan → lock → atomic); the markdown-native
// quick-notes store is appended directly but still scrubbed + injection-scanned.
//
// This is the single capture authority both the Claude and Codex hooks call — the
// hooks stay thin wrappers, so the locking/scrub/scan logic lives in ONE place.
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { writeStoreEntry } from "../state/meowkit-write-contract.js";
import { resolveMeowkitRoot } from "../state/meowkit-root-resolver.js";
import { scrubSecrets, validateContent, normalizeForScan } from "../state/injection-scanner.js";

interface PrefixRoute {
	prefix: string;
	store: "architecture-decisions" | "review-patterns" | "quick-notes";
	type: string;
}

// ##pattern is category-routed in the legacy handler; the CLI uses the default
// (review-patterns) route — richer category detection can layer on later.
const PREFIX_ROUTES: readonly PrefixRoute[] = [
	{ prefix: "##decision:", store: "architecture-decisions", type: "decision" },
	{ prefix: "##pattern:", store: "review-patterns", type: "pattern" },
	{ prefix: "##note:", store: "quick-notes", type: "note" },
];

export type CaptureResult = { captured: false } | { captured: true; store: string; entryId: string };

export interface CaptureOptions {
	startDir?: string;
	now?: string;
	id?: string;
}

/** Capture a `##prefix`-tagged prompt into the right `.meowkit/memory` store.
 *  Returns `{captured:false}` for a non-prefixed prompt (the fast no-op path). */
export async function captureFromPrompt(prompt: string, opts: CaptureOptions = {}): Promise<CaptureResult> {
	const trimmed = prompt.trimStart();
	const route = PREFIX_ROUTES.find((r) => trimmed.toLowerCase().startsWith(r.prefix));
	if (!route) return { captured: false };

	const content = trimmed.slice(route.prefix.length).trim();
	if (!content) return { captured: false };

	// Injection scan applies to both paths (hook input is untrusted).
	const scan = validateContent(normalizeForScan(content));
	if (!scan.valid) throw new Error(`capture rejected (injection: ${scan.match ?? scan.pattern})`);

	const now = opts.now ?? new Date().toISOString();
	const id =
		opts.id ??
		`capture-${createHash("sha1")
			.update(now + content)
			.digest("hex")
			.slice(0, 10)}`;

	if (route.store === "quick-notes") {
		const meowkitRoot = resolveMeowkitRoot(opts.startDir ?? process.cwd());
		if (!meowkitRoot) throw new Error("cannot resolve a project root for .meowkit/memory");
		const memoryDir = join(meowkitRoot, "memory");
		mkdirSync(memoryDir, { recursive: true });
		appendFileSync(join(memoryDir, "quick-notes.md"), `\n## ${now}\n\n${scrubSecrets(content)}\n`, "utf-8");
		return { captured: true, store: "quick-notes.md", entryId: id };
	}

	const res = await writeStoreEntry(
		route.store,
		{ id, pattern: content, type: route.type, timestamp: now },
		{ startDir: opts.startDir, now },
	);
	if (!res.ok) throw new Error(`capture rejected (${res.reason}: ${res.detail})`);
	return { captured: true, store: `${route.store}.json`, entryId: res.entryId };
}
