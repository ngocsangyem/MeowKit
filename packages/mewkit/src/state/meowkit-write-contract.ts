// The single structured-write contract for the canonical `.meowkit/memory/` stores.
// Every managed writer (CLI, capture hooks, adapters) goes through here so the
// pipeline is uniform and auditable:
//   zod schema validation → secret scrub → injection scan → per-store lock
//   (nested under any active migration lock) → dedupe → atomic replace.
// Skills/hooks/adapters never construct provider paths or hand-roll this pipeline.
import { existsSync } from "node:fs";
import * as fsp from "node:fs/promises";
import { join } from "node:path";
import { CURATED_STORES, type StoreSpec } from "../memory/schemas.js";
import { resolveMeowkitRoot } from "./meowkit-root-resolver.js";
import { scrubSecrets, validateContent, normalizeForScan } from "./injection-scanner.js";
import { withStoreLock, type StoreLockOptions } from "./store-lock.js";

export interface WriteStoreOptions extends StoreLockOptions {
	/** Where to start project-root resolution (defaults to process.cwd()). */
	startDir?: string;
	/** Pre-resolved `.meowkit/` dir; skips resolution when provided. */
	meowkitRoot?: string;
	/** ISO timestamp override for deterministic tests. */
	now?: string;
}

export type WriteStoreResult =
	{ ok: true; deduped: boolean; entryId: string } | { ok: false; reason: "schema" | "injection"; detail: string };

type StoreEntry = Record<string, unknown>;
type StoreFile = { version: string; scope: string; consumer: string; metadata?: Record<string, unknown> } & Record<
	string,
	unknown
>;

function specFor(store: string): StoreSpec {
	const spec = CURATED_STORES.find((s) => s.scope === store);
	if (!spec)
		throw new Error(`unknown memory store: ${store} (known: ${CURATED_STORES.map((s) => s.scope).join(", ")})`);
	return spec;
}

function emptySkeleton(spec: StoreSpec, now: string): StoreFile {
	return {
		version: "2.0.0",
		scope: spec.scope,
		consumer: "meowkit",
		[spec.itemsKey]: [],
		metadata: { created: now, last_updated: now },
	};
}

/** Scrub secrets in every configured text field (mutates a shallow copy). */
function scrubEntry(entry: StoreEntry, spec: StoreSpec): StoreEntry {
	const out: StoreEntry = { ...entry };
	for (const field of spec.textFields) {
		if (typeof out[field] === "string") out[field] = scrubSecrets(out[field] as string);
	}
	return out;
}

/** First injection hit across the configured text fields, or null when clean. */
function firstInjection(entry: StoreEntry, spec: StoreSpec): string | null {
	for (const field of spec.textFields) {
		const value = entry[field];
		if (typeof value !== "string") continue;
		const check = validateContent(normalizeForScan(value));
		if (!check.valid) return `${field}: ${check.match ?? check.pattern}`;
	}
	return null;
}

/** Injectable seam so tests can force a rename failure without spying on the
 *  (non-configurable) `node:fs/promises` ESM namespace. Production passes nothing. */
export interface AtomicReplaceDeps {
	rename?: typeof fsp.rename;
}

/** Atomic replace: write a sibling temp file, then rename over the target. On any
 *  failure the target keeps its prior content and the temp file is cleaned up. */
export async function atomicReplace(targetPath: string, content: string, deps: AtomicReplaceDeps = {}): Promise<void> {
	const rename = deps.rename ?? fsp.rename;
	const tmpPath = `${targetPath}.tmp.${process.pid}.${Math.round(performance.now())}`;
	await fsp.writeFile(tmpPath, content, "utf-8");
	try {
		await rename(tmpPath, targetPath);
	} catch (err) {
		await fsp.rm(tmpPath, { force: true });
		throw err;
	}
}

export async function writeStoreEntry(
	store: string,
	entry: StoreEntry,
	opts: WriteStoreOptions = {},
): Promise<WriteStoreResult> {
	const spec = specFor(store);
	const meowkitRoot = opts.meowkitRoot ?? resolveMeowkitRoot(opts.startDir ?? process.cwd());
	if (!meowkitRoot) throw new Error("cannot resolve a project root for the .meowkit/ state directory");
	const now = opts.now ?? new Date().toISOString();

	// Scan the RAW entry first (reject) — secret scrub runs on the accepted entry.
	const injection = firstInjection(entry, spec);
	if (injection) return { ok: false, reason: "injection", detail: injection };
	const scrubbed = scrubEntry(entry, spec);

	const memoryDir = join(meowkitRoot, "memory");
	const targetPath = join(memoryDir, spec.file);

	return withStoreLock(
		meowkitRoot,
		spec.scope,
		async (): Promise<WriteStoreResult> => {
			let file: StoreFile;
			if (existsSync(targetPath)) {
				file = JSON.parse(await fsp.readFile(targetPath, "utf-8")) as StoreFile;
			} else {
				file = emptySkeleton(spec, now);
			}
			const items = (Array.isArray(file[spec.itemsKey]) ? (file[spec.itemsKey] as StoreEntry[]) : []).slice();

			const entryId = String(scrubbed.id ?? "");
			if (entryId && items.some((it) => String(it.id) === entryId)) {
				return { ok: true, deduped: true, entryId };
			}

			items.push(scrubbed);
			const candidate: StoreFile = {
				...file,
				[spec.itemsKey]: items,
				metadata: { ...file.metadata, last_updated: now },
			};

			const parsed = spec.schema.safeParse(candidate);
			if (!parsed.success) {
				const detail = parsed.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; ");
				return { ok: false, reason: "schema", detail };
			}

			await fsp.mkdir(memoryDir, { recursive: true });
			await atomicReplace(targetPath, `${JSON.stringify(candidate, null, 2)}\n`);
			return { ok: true, deduped: false, entryId };
		},
		opts,
	);
}
