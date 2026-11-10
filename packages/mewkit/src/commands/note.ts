// `mewkit note <decisions|gotchas>` — the serialized write path for the committed team-memory
// store. Entry text arrives on stdin; the command validates shape, runs the SAME content scan
// `validate --memory` runs, takes the memory write lock, and appends.
//
// Why a command and not an agent `Edit`: `decisions.md` / `gotchas.md` are the only durable
// shared artifacts in the repo, and an Edit is read-whole → replace → write-whole. Two agents
// appending at once (parallel cook runs, or fix + a background review) silently lose one
// entry, and the lint cannot see a missing entry. Every other durable writer in the CLI already
// serializes through `withFileLock`; this closes the one gap.
//
// Why the scan runs BEFORE the write: a rejected entry must leave the store byte-identical, so
// a poisoned or secret-bearing entry never lands and never has to be removed from git history.
// And the rejection names the finding KIND and LINE only — never the matched text — because a
// secret echoed into a terminal or a CI log is the leak the check exists to prevent.
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { countLines, scanMemoryContent } from "../state/memory-content-scan.js";
import { MEMORY_FILE_MAX_LINES } from "../core/check-memory-store.js";
import { resolveStateDir } from "../state/resolve-state-dir.js";
import { resolveProjectRoot } from "../state/meowkit-root-resolver.js";
import { withFileLock } from "../core/file-lock.js";

/** The two-file contract. Anything else is not memory. */
export const NOTE_FILES = ["decisions", "gotchas"] as const;
export type NoteFile = (typeof NOTE_FILES)[number];

/** An entry is a handful of lines. A cap this size rejects a pasted log before it is scanned. */
export const NOTE_MAX_BYTES = 16 * 1024;

/** Lines the approved entry format requires, so an entry is reviewable and prunable. */
const REQUIRED_MARKERS = ["Why:", "Apply when:", "Source:"] as const;

const USAGE = [
	"Usage: mewkit note <decisions|gotchas>   (entry text on stdin)",
	"",
	"The entry must start with a `## ` heading line and contain:",
	"  Why:          why the decision/gotcha is non-obvious",
	"  Apply when:   the situation a future session should recognise",
	"  Source:       the file, symbol or commit it came from",
	"",
	"Example:",
	"  printf '## Vitest serializes files here   <!-- 2026-11-01 -->\\nWhy: ...\\nApply when: ...\\nSource: vitest.config.ts\\n' \\",
	"    | mewkit note gotchas",
].join("\n");

export interface NoteOptions {
	/** Positional: which store file to append to. */
	file?: string;
	/** Entry text. Read from stdin when omitted (the normal path; tests inject directly). */
	entry?: string;
	/** Project root override; defaults to the resolved root of the cwd. */
	root?: string;
}

/** Shape validation. Returns an error message, or null when the entry is well-formed. */
export function validateNoteShape(entry: string): string | null {
	const trimmed = entry.trim();
	if (trimmed === "") return "the entry is empty — nothing to append";
	const lines = trimmed.split(/\r\n|\r|\n/);
	if (!lines[0].startsWith("## ")) {
		return "the entry must start with a `## ` heading line";
	}
	const missing = REQUIRED_MARKERS.filter((marker) => !lines.some((line) => line.trimStart().startsWith(marker)));
	if (missing.length > 0) {
		return `the entry is missing a ${missing.join(" line, a ")} line`;
	}
	return null;
}

/** The lock path for one store file.
 *
 *  It lives under the `state` class, NEVER inside `.meowkit/memory/`. The memory directory is
 *  committed and grep-read; a lock sidecar in there would show up in the PR diff, in the read
 *  surface, and in the lint's own scan. */
export function noteLockPath(projectRoot: string, file: NoteFile): string {
	return path.join(resolveStateDir(projectRoot, "state"), "locks", `memory-${file}.lock`);
}

/** Thrown when an append would push a store file over the lint's line cap. Refusing here keeps
 *  the failure at write time, where the fix (prune) is obvious, instead of surfacing later as a
 *  blocked commit in the pre-ship hook. */
export class NoteCapError extends Error {}

function readStdin(): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
		process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
		process.stdin.on("error", reject);
	});
}

/** Append `entry` to the store file under the write lock. Returns the project-relative path. */
export async function appendNote(projectRoot: string, file: NoteFile, entry: string): Promise<string> {
	const memoryDir = resolveStateDir(projectRoot, "memory");
	const target = path.join(memoryDir, `${file}.md`);
	const lockPath = noteLockPath(projectRoot, file);
	mkdirSync(path.dirname(lockPath), { recursive: true });
	mkdirSync(memoryDir, { recursive: true });

	// Exactly one trailing newline, so the separator logic below is deterministic.
	const body = `${entry.trim()}\n`;

	await withFileLock(lockPath, async () => {
		let prefix = "";
		let existing = "";
		if (existsSync(target) && statSync(target).size > 0) {
			// One blank line between entries.
			existing = readFileSync(target, "utf-8");
			prefix = existing.slice(-2).endsWith("\n") ? "\n" : "\n\n";
		}
		const after = countLines(existing + prefix + body);
		if (after > MEMORY_FILE_MAX_LINES) {
			throw new NoteCapError(
				`${path.basename(target)} would reach ${after} lines, over the ${MEMORY_FILE_MAX_LINES}-line cap — run /mk:memory --prune first`,
			);
		}
		// `appendFileSync` opens with "a" (O_APPEND), so the write is positioned at the
		// end-of-file by the kernel at write time — a concurrent holder's append cannot be
		// overwritten even if one slipped past the lock.
		appendFileSync(target, prefix + body, "utf-8");
	});

	return path.relative(projectRoot, target);
}

export async function note(opts: NoteOptions = {}): Promise<void> {
	const file = opts.file;
	if (!file || !(NOTE_FILES as readonly string[]).includes(file)) {
		console.error(pc.red(file ? `Unknown memory file "${file}".` : "Missing the memory file argument."));
		console.error(USAGE);
		process.exit(1);
	}

	const entry = opts.entry ?? (await readStdin());
	const shapeError = validateNoteShape(entry);
	if (shapeError) {
		console.error(pc.red(`Rejected: ${shapeError}.`));
		console.error(USAGE);
		process.exit(1);
	}

	const findings = scanMemoryContent(entry, { maxBytes: NOTE_MAX_BYTES });
	if (findings.length > 0) {
		console.error(pc.red(`Rejected: ${findings.length} finding(s) — nothing was written.`));
		for (const finding of findings) {
			// Kind and location only. The matched text is deliberately NOT printed.
			const where = finding.line > 0 ? `line ${finding.line}` : "whole entry";
			console.error(pc.red(`  ${finding.kind}: ${where}`));
		}
		process.exit(1);
	}

	const projectRoot = opts.root ?? resolveProjectRoot(process.cwd()) ?? process.cwd();
	try {
		const written = await appendNote(projectRoot, file as NoteFile, entry);
		console.log(`appended to ${written}`);
	} catch (err) {
		if (!(err instanceof NoteCapError)) throw err;
		console.error(pc.red(`Rejected: ${err.message}. Nothing was written.`));
		process.exit(1);
	}
}
