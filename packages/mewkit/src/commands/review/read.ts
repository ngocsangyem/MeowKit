import fs from "node:fs";
import path from "node:path";
import { safeParseReviewManifest } from "../../review/schema.js";

// `mewkit review read --session <id> --as <reviewer> <path>` — print an assigned
// artifact to stdout AND append an EvidenceEvent to evidence.jsonl. Reads are
// CONFINED to the session dir and the review worktree — no arbitrary file
// exfiltration. The Bash PostToolUse hook independently tags the invocation, so a
// read done in the driving session corroborates to `session-observed`; a subagent
// read stays `attested` (see phase-04-capability-spike).

const SESSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface ReadOptions {
	session: string;
	as: string; // reviewer role label (NOT authenticated identity)
	target: string;
	cwd?: string;
	now?: () => string;
}

export interface ReadResult {
	ok: boolean;
	error?: string;
	content?: string;
	loggedTarget?: string;
}

function contained(root: string, p: string): boolean {
	const r = path.resolve(root);
	const t = path.resolve(p);
	return t === r || t.startsWith(r + path.sep);
}

export async function reviewRead(options: ReadOptions): Promise<ReadResult> {
	const cwd = options.cwd ?? process.cwd();
	const now = options.now?.() ?? new Date().toISOString();
	const fail = (error: string): ReadResult => {
		console.error(`✗ ${error}`);
		process.exitCode = 1;
		return { ok: false, error };
	};

	if (!options.session || options.session.includes("..") || !SESSION_RE.test(options.session))
		return fail(`invalid --session "${options.session}"`);
	if (!options.as || !SESSION_RE.test(options.as)) return fail(`invalid --as reviewer id "${options.as}"`);
	if (!options.target) return fail("a <path> to read is required");

	const sessionDir = path.join(cwd, "tasks", "reviews", options.session);
	if (!fs.existsSync(path.join(sessionDir, "manifest.json")))
		return fail(`no review session at ${path.relative(cwd, sessionDir)}`);

	// Resolve the worktree root from the manifest (validated) for the source-read root.
	let worktreeAbs: string | null = null;
	try {
		const manifest = JSON.parse(fs.readFileSync(path.join(sessionDir, "manifest.json"), "utf-8"));
		if (safeParseReviewManifest(manifest).success) worktreeAbs = path.resolve(cwd, String(manifest.worktreePath));
	} catch {
		/* manifest unreadable → session-dir reads still allowed */
	}

	// The requested path must resolve inside the session dir OR the worktree.
	const roots: string[] = [sessionDir];
	if (worktreeAbs) roots.push(worktreeAbs);
	let resolved: string | null = null;
	let loggedTarget: string | null = null;
	for (const root of roots) {
		const candidate = path.resolve(root, options.target);
		if (!contained(root, candidate)) continue; // lexical fast-reject
		// SYMLINK GUARD: the worktree holds attacker-controlled PR code. A purely
		// lexical check follows a symlink out of the root, so confine on the REAL
		// (symlink-resolved) path of both the file and the root. realpath also
		// normalizes the macOS /tmp→/private/tmp indirection so the logged target
		// stays consistent with the hook side.
		let real: string;
		let realRoot: string;
		try {
			real = fs.realpathSync(candidate);
			realRoot = fs.realpathSync(root);
		} catch {
			continue; // broken/dangling symlink or missing path
		}
		if (!contained(realRoot, real) || !fs.statSync(real).isFile()) continue; // escaped the root → reject
		resolved = real;
		loggedTarget = path.relative(realRoot, real);
		break;
	}
	if (!resolved || loggedTarget == null)
		return fail(
			`"${options.target}" not found inside the session dir or review worktree (reads are confined to those roots; symlinks may not escape them)`,
		);

	const content = fs.readFileSync(resolved, "utf-8");
	process.stdout.write(content);

	// Append the CLI evidence receipt (best-effort; a logging failure must not hide the read).
	try {
		const event = {
			session: options.session,
			kind: "read",
			target: loggedTarget,
			at: now,
			reviewer: options.as,
			source: "cli" as const,
		};
		fs.appendFileSync(path.join(sessionDir, "evidence.jsonl"), `${JSON.stringify(event)}\n`);
	} catch (e) {
		console.error(`⚠ evidence not recorded: ${(e as Error).message}`);
	}

	return { ok: true, content, loggedTarget };
}
