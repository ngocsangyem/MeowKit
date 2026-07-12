// Task-scoped repository context (Phase 5): an on-demand evidence LEDGER, not a retrieval
// engine. MeowKit resolves a path's owning repository + revision, hashes it for path-scoped
// freshness, and records/verifies an evidence envelope — the HOST's native tools acquire the
// content. Retrieved bytes are DATA (never instructions); secret-shaped paths are redacted.
// Revision is read directly from git refs (no `git` binary), and is PROVENANCE — freshness is
// per-file-hash, so one repo advancing never marks another repo's untouched evidence stale.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, relative, isAbsolute, sep } from "node:path";
import { z } from "zod";
import { hashFile } from "./compute-checksums.js";

/**
 * A path is secret-shaped when ANY of its segments looks like a credential/key store
 * (mirrors + extends injection-rules Rule 4). Checked per-segment so a `secrets/` or
 * `.ssh/` directory anywhere in the path is caught, not just the basename.
 */
export function isSecretPath(p: string): boolean {
	return p.split(/[/\\]/).some((seg) => {
		const s = seg.toLowerCase();
		return (
			s === ".env" ||
			s.startsWith(".env.") || // .env.local, .env.production, …
			s === ".npmrc" ||
			s === ".netrc" ||
			s === ".ssh" ||
			s.includes("credential") ||
			s.includes("secret") ||
			/(^|[._-])token([._-]|$)/.test(s) || // access_token, token.json — not "tokenizer"
			/^id_(rsa|dsa|ecdsa|ed25519)$/.test(s) ||
			/\.(pem|key|keystore|p12|pfx|jks)$/.test(s)
		);
	});
}

/** A resolved git revision must be a hex object id — never arbitrary file content. */
const SHA_RE = /^[0-9a-f]{7,64}$/;

export interface OwningRepo {
	/** Repo root (git) or the boundary root (non-git) — a stable identity, never invented. */
	identity: string;
	/** Git HEAD revision when resolvable; null for non-git or unresolvable HEAD (provenance only). */
	revision: string | null;
	isGit: boolean;
}

/** Resolve the `.git` metadata dir, following a `.git` FILE (worktree/submodule gitdir pointer).
 * Best-effort: any fs error yields null (revision is provenance, never load-bearing). */
function resolveGitDir(repoRoot: string): string | null {
	try {
		const dotgit = join(repoRoot, ".git");
		if (!existsSync(dotgit)) return null;
		if (statSync(dotgit).isDirectory()) return dotgit;
		// `.git` is a file: `gitdir: <path>`
		const m = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotgit, "utf-8"));
		if (!m) return null;
		const gd = m[1].trim();
		return isAbsolute(gd) ? gd : resolve(repoRoot, gd);
	} catch {
		return null;
	}
}

/** Read the HEAD revision from a git metadata dir directly (HEAD → ref → packed-refs). */
function readHeadRevision(gitDir: string): string | null {
	try {
		return readHeadRevisionUnsafe(gitDir);
	} catch {
		return null; // best-effort provenance — a crafted/unreadable repo never crashes resolution
	}
}
function readHeadRevisionUnsafe(gitDir: string): string | null {
	const headPath = join(gitDir, "HEAD");
	if (!existsSync(headPath)) return null;
	const head = readFileSync(headPath, "utf-8").trim();
	if (head.startsWith("ref:")) {
		const ref = head.slice(4).trim(); // refs/heads/<branch>
		const refFile = join(gitDir, ref);
		// SECURITY: HEAD is untrusted repo DATA. Only return a value that is a hex object id,
		// and only from a ref file still contained in gitDir — a crafted `ref: ../../etc/passwd`
		// must never read arbitrary file content into the revision field.
		if (existsSync(refFile) && isWithinBoundary(gitDir, refFile)) {
			const sha = readFileSync(refFile, "utf-8").trim();
			if (SHA_RE.test(sha)) return sha;
		}
		const packed = join(gitDir, "packed-refs");
		if (existsSync(packed)) {
			for (const line of readFileSync(packed, "utf-8").split("\n")) {
				const m = /^([0-9a-f]{7,64})\s+(.+)$/.exec(line.trim());
				if (m && m[2] === ref) return m[1];
			}
		}
		return null;
	}
	return SHA_RE.test(head) ? head : null; // detached HEAD
}

/**
 * Resolve the repository that OWNS `absPath` by walking up to the nearest ancestor containing
 * a `.git` marker (never crossing above `boundaryRoot` when given). A git match yields the repo
 * root + its HEAD revision; no match yields the boundary root (or the path's dir) as a stable
 * non-git identity with a null revision — never a fabricated one. Each path resolves to its OWN
 * nested repo, so a multi-repo parent (e.g. Aspire) is not treated as one repository.
 */
export function resolveOwningRepo(absPath: string, boundaryRoot?: string): OwningRepo {
	const startDir = existsSync(absPath) && statSync(absPath).isDirectory() ? absPath : dirname(absPath);
	const boundary = boundaryRoot ? resolve(boundaryRoot) : null;
	let dir = resolve(startDir);
	// Defense in depth: never walk a start path that lies outside the boundary (a caller that
	// skipped the containment gate must not make us climb to an unrelated parent repo).
	if (boundary && !isWithinBoundary(boundary, dir)) return { identity: boundary, revision: null, isGit: false };
	for (;;) {
		if (existsSync(join(dir, ".git"))) {
			const gitDir = resolveGitDir(dir);
			return { identity: dir, revision: gitDir ? readHeadRevision(gitDir) : null, isGit: true };
		}
		if (boundary && dir === boundary) break; // do not cross the boundary
		const parent = dirname(dir);
		if (parent === dir) break; // filesystem root
		dir = parent;
	}
	return { identity: boundary ?? startDir, revision: null, isGit: false };
}

export const EvidenceRefSchema = z.object({
	path: z.string(),
	/** SHA-256 of the file content at record time, or null when the file was missing. */
	contentHash: z.string().nullable(),
	owningRepoIdentity: z.string(),
	revision: z.string().nullable(),
	provenance: z.enum(["host-read", "host-search"]).default("host-read"),
	/** True when the path is secret-shaped and its content must not be persisted verbatim. */
	redacted: z.boolean().default(false),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const ContextEnvelopeSchema = z.object({
	schemaVersion: z.literal("1.0"),
	/** The task's scope/container (e.g. an Aspire-style parent holding many repos). It is NOT
	 * itself a repository — each evidence ref names its OWN owning repo + revision. Multi-repo
	 * context is therefore never collapsed into one identity. */
	boundaryRoot: z.string(),
	evidence: z.array(EvidenceRefSchema).default([]),
	queryDescriptor: z.string().default(""),
	toolDescriptor: z.string().default(""),
	timestamp: z.string(),
	omissions: z.array(z.string()).default([]),
});
export type ContextEnvelope = z.infer<typeof ContextEnvelopeSchema>;

export interface RepoRef {
	identity: string;
	revision: string | null;
}

/**
 * The DISTINCT owning repositories represented in an evidence set, each with its own revision.
 * This is the multi-repo context view: a task touching several repos under one container (e.g.
 * Aspire) surfaces every repo separately — no repo's identity/revision is lost or conflated.
 */
export function distinctRepos(refs: EvidenceRef[]): RepoRef[] {
	const byIdentity = new Map<string, string | null>();
	for (const r of refs) if (!byIdentity.has(r.owningRepoIdentity)) byIdentity.set(r.owningRepoIdentity, r.revision);
	return [...byIdentity]
		.map(([identity, revision]) => ({ identity, revision }))
		.sort((a, b) => (a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0));
}

/** Hash an evidence file for freshness; null when it does not exist (missing evidence). */
export function hashEvidence(absPath: string): string | null {
	return existsSync(absPath) ? hashFile(absPath) : null;
}

/**
 * Build an evidence reference for a path: owning repo + revision, content hash, and a redaction
 * flag for secret-shaped paths (whose CONTENT must never be persisted — only the hash + flag).
 */
export function buildEvidenceRef(
	absPath: string,
	boundaryRoot: string,
	provenance: EvidenceRef["provenance"] = "host-read",
): EvidenceRef {
	const owner = resolveOwningRepo(absPath, boundaryRoot);
	const redacted = isSecretPath(absPath);
	return {
		path: absPath,
		// A secret-shaped file is NOT hashed — even a content hash of a low-entropy secret is a
		// weak confirmation oracle. Its presence is tracked; its content never touches the record.
		contentHash: redacted ? null : hashEvidence(absPath),
		owningRepoIdentity: owner.identity,
		revision: owner.revision,
		provenance,
		redacted,
	};
}

export type FreshnessStatus = "fresh" | "stale" | "missing" | "out-of-scope";

/**
 * Path-scoped freshness: re-hash each recorded evidence path and compare to its recorded hash.
 * A repo advancing its revision does NOT make untouched files stale — only a changed hash does.
 *
 * SECURITY: an envelope is untrusted DATA (it can ship in a third-party repo or be produced by
 * an injection-tricked agent). When `boundaryRoot` is given, a path outside it is reported
 * `out-of-scope` and is NEVER stat-ed or hashed — otherwise `check` would become an
 * existence/hash oracle for arbitrary absolute paths (e.g. `~/.ssh/id_rsa`, `/etc/passwd`).
 */
export function checkEvidenceFreshness(
	refs: EvidenceRef[],
	boundaryRoot?: string,
): { path: string; status: FreshnessStatus }[] {
	return refs.map((ref) => {
		if (boundaryRoot && !isWithinBoundary(boundaryRoot, ref.path)) {
			return { path: ref.path, status: "out-of-scope" as const };
		}
		const current = hashEvidence(ref.path);
		if (current === null) return { path: ref.path, status: "missing" as const };
		if (ref.contentHash === null || current !== ref.contentHash) return { path: ref.path, status: "stale" as const };
		return { path: ref.path, status: "fresh" as const };
	});
}

/** True when `target` stays within `boundaryRoot` (lexical; used to reject out-of-scope evidence). */
export function isWithinBoundary(boundaryRoot: string, target: string): boolean {
	const rel = relative(resolve(boundaryRoot), resolve(target));
	return rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel);
}
