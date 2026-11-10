// `mewkit validate --memory` — lint the committed team-memory store.
//
// v3 memory is plain markdown under `.meowkit/memory/`, committed and reviewed in the PR
// diff. There is no index, no schema and no approve gate, so this lint plus the PR diff are
// the guard. It enforces four properties, all load-bearing:
//   1. SIZE — a file over MEMORY_FILE_MAX_LINES lines, or over the byte cap, has stopped
//      being a recall surface and become a dump; the read path (one grep) degrades and the
//      PR diff stops being reviewable.
//   2. INJECTION — memory is DATA. Instruction-like text in a file that read-set skills
//      open is a stored prompt-injection vector, scanned through every decode pass
//      `injection-rules.md` Rule 8 names, not just plaintext.
//   3. SECRETS — security findings and credentials never belong in a shared, committed
//      recall file. Scanned per line AND whole-body, because a PEM block spans lines.
//   4. SCANNABILITY — the documented read is `grep -ril … .meowkit/memory/`, which is
//      recursive and not extension-filtered. So the lint walks the same surface, and any
//      path it CANNOT read is a FAIL finding, never an affirmative "clean" verdict. A guard
//      that silently skips what it cannot open is worse than no guard.
// A missing directory or an empty store is a PASS: there is nothing to lint, and a project
// that has never recorded a lesson is healthy, not broken.
import fs from "node:fs";
import path from "node:path";
import type { CheckResult } from "../commands/validate.js";
import { scanMemoryContent, countLines, type MemoryFindingKind } from "../state/memory-content-scan.js";
import { MAX_CONTENT_BYTES } from "../state/obfuscation-passes.js";
import { errnoOf, readForScan, walkStore } from "./walk-memory-store.js";
import { resolveStateDir } from "../state/resolve-state-dir.js";

/** A memory file longer than this has stopped being a recall surface. */
export const MEMORY_FILE_MAX_LINES = 300;
/** Per-file byte ceiling: a 3-line file of any byte size used to pass the line cap. */
export const MEMORY_FILE_MAX_BYTES = MAX_CONTENT_BYTES;

export interface MemoryFinding {
	/** Project-relative path of the offending file. */
	file: string;
	/** 1-based line number; 0 when the finding is about the file as a whole. */
	line: number;
	kind: MemoryFindingKind;
	detail: string;
}

/**
 * Scan every file in the project's memory store. Returns one finding per problem; an empty
 * array means the store is clean (or absent).
 */
export function findMemoryStoreFindings(projectRoot: string): MemoryFinding[] {
	const memoryDir = resolveStateDir(projectRoot, "memory");
	if (!fs.existsSync(memoryDir)) return [];

	const rel = (p: string): string => path.relative(projectRoot, p);

	// The store MUST be a directory. A botched `>` redirect turns it into a file, which the
	// old `readdirSync` + `catch { return [] }` reported as an affirmatively clean store.
	let dirStat: fs.Stats;
	try {
		dirStat = fs.statSync(memoryDir);
	} catch (error) {
		return [
			{ file: rel(memoryDir), line: 0, kind: "unreadable", detail: `store could not be stat'd (${errnoOf(error)})` },
		];
	}
	if (!dirStat.isDirectory()) {
		return [
			{
				file: rel(memoryDir),
				line: 0,
				kind: "unreadable",
				detail: "the memory store path is not a directory — the write path is broken and nothing was scanned",
			},
		];
	}

	const walked = walkStore(memoryDir);
	const findings: MemoryFinding[] = walked.unreadable.map((entry) => ({
		file: rel(entry.path),
		line: 0,
		kind: "unreadable" as const,
		detail: entry.detail,
	}));

	for (const fullPath of walked.files) {
		const relative = rel(fullPath);
		const read = readForScan(fullPath, MEMORY_FILE_MAX_BYTES);
		if ("finding" in read) {
			findings.push({ file: relative, ...read.finding });
			continue;
		}

		const lineCount = countLines(read.body);
		if (lineCount > MEMORY_FILE_MAX_LINES) {
			findings.push({
				file: relative,
				line: 0,
				kind: "size",
				detail: `${lineCount} lines exceeds the ${MEMORY_FILE_MAX_LINES}-line cap — prune or split the store`,
			});
		}

		for (const finding of scanMemoryContent(read.body, { maxBytes: MEMORY_FILE_MAX_BYTES })) {
			findings.push({ file: relative, ...finding });
		}
	}
	return findings;
}

/** `validate --memory` as CheckResults. A clean or absent store reports a single PASS. */
export function checkMemoryStore(projectRoot: string): CheckResult[] {
	const memoryDir = resolveStateDir(projectRoot, "memory");
	const relativeDir = path.relative(projectRoot, memoryDir);
	const pass = (detail: string): CheckResult[] => [
		{ name: "Team memory store lint", status: "pass", detail, section: "Memory" },
	];

	if (!fs.existsSync(memoryDir)) {
		return pass(`No memory store yet (${relativeDir}) — created on the first memory write.`);
	}

	const findings = findMemoryStoreFindings(projectRoot);
	if (findings.length === 0) {
		return pass(
			`Store under ${relativeDir} is within the ${MEMORY_FILE_MAX_LINES}-line cap, injection-free and secret-free.`,
		);
	}

	return findings.map((finding) => ({
		name: `Memory ${finding.kind}: ${finding.file}${finding.line > 0 ? `:${finding.line}` : ""}`,
		status: "fail" as const,
		detail: finding.detail,
		section: "Memory" as const,
	}));
}
