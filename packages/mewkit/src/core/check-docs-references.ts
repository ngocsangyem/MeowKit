import fs from "node:fs";
import path from "node:path";
import { CONTRACT_REL_PATH, FILE_WHITELIST, resolveContractPath } from "./docs-reference-contract-paths.js";

export interface DocsRefFinding {
	file: string;
	line: number;
	token: string;
	level: "ERROR" | "WARN";
	reason: string;
}

export interface DocsRefResult {
	scannedFiles: number;
	findings: DocsRefFinding[];
	errorCount: number;
	warnCount: number;
	/**
	 * True when the maintainer contract is absent, so there was no allowlist to check
	 * against. A user project ships `.claude/` without it, which is N/A, not a failure.
	 */
	notApplicable?: boolean;
}

// Subdirectories under .claude/ that ship in the release zip.
// Adding more subdirs is safe — they only get scanned if present.
const SCAN_DIRS = [
	"agents",
	"skills",
	"commands",
	"memory",
	"hooks",
	"scripts",
	"rules",
	"modes",
	"benchmarks",
];

// Skill dirs whose Grep-of-user-project semantics need an opt-out from path checks.
const SKILL_DIR_WHITELIST = new Set(["skills/docs-finder"]);

interface AllowlistData {
	allowed: string[];
	reserved: string[];
}

/** Parse the Type-1 allowlist from docs-reference-contract.md. */
export function parseAllowlist(contractPath: string): AllowlistData {
	const content = fs.readFileSync(contractPath, "utf-8");
	const allowed = extractFenced(content, "ALLOWLIST-START", "ALLOWLIST-END");
	const reserved = extractFenced(content, "RESERVED-START", "RESERVED-END");
	return { allowed, reserved };
}

function extractFenced(content: string, startMarker: string, endMarker: string): string[] {
	const startTag = `<!-- ${startMarker} -->`;
	const endTag = `<!-- ${endMarker} -->`;
	const startIdx = content.indexOf(startTag);
	const endIdx = content.indexOf(endTag);
	if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return [];
	const block = content.slice(startIdx + startTag.length, endIdx);
	return block
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("<!--"));
}

function isAllowed(token: string, allowed: string[]): boolean {
	for (const entry of allowed) {
		if (entry.endsWith("/")) {
			if (token.startsWith(entry)) return true;
		} else if (token === entry) {
			return true;
		}
	}
	return false;
}

/** Strip http/https URLs and angle-bracket-wrapped content (HTML tags, placeholders). */
function stripNoise(line: string): string {
	return line.replace(/https?:\/\/[^\s)\]\"'`,]+/g, "").replace(/<[^>]*>/g, "");
}

/** Extract docs/<path> tokens from a single line. Hyphen-safe regex. */
function extractTokens(line: string): string[] {
	const cleaned = stripNoise(line);
	const matches: string[] = [];
	const re = /docs\/[A-Za-z0-9_./\-]+/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(cleaned)) !== null) {
		const token = m[0].replace(/[.,)\]]+$/, "");
		matches.push(token);
	}
	return matches;
}

function walkMd(dir: string, out: string[] = []): string[] {
	if (!fs.existsSync(dir)) return out;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			// `__tests__` joins `tests` here: a docs/ path inside a test file is
			// fixture data, not a runtime reference. The contract exists because a
			// reference to a non-shipped docs/ path breaks in a consumer project —
			// a fixture string is never resolved, so it cannot break anything.
			if (
				entry.name === "node_modules" ||
				entry.name === ".venv" ||
				entry.name === "tests" ||
				entry.name === "__tests__" ||
				entry.name === "__pycache__"
			)
				continue;
			walkMd(full, out);
		} else if (
			entry.isFile() &&
			(entry.name.endsWith(".md") ||
				entry.name.endsWith(".sh") ||
				entry.name.endsWith(".py") ||
				entry.name.endsWith(".cjs") ||
				entry.name.endsWith(".js"))
		) {
			out.push(full);
		}
	}
	return out;
}

function isInWhitelistedSkill(relPath: string): boolean {
	for (const prefix of SKILL_DIR_WHITELIST) {
		if (relPath.startsWith(prefix + "/") || relPath.startsWith(prefix + path.sep)) return true;
	}
	return false;
}

export function checkDocsReferences(claudeDir: string): DocsRefResult {
	const contractPath = resolveContractPath(claudeDir);
	if (!fs.existsSync(contractPath)) {
		return { scannedFiles: 0, findings: [], errorCount: 0, warnCount: 0, notApplicable: true };
	}
	const { allowed, reserved } = parseAllowlist(contractPath);

	const findings: DocsRefFinding[] = [];
	let scannedFiles = 0;

	for (const sub of SCAN_DIRS) {
		const dir = path.join(claudeDir, sub);
		const files = walkMd(dir);
		for (const file of files) {
			scannedFiles++;
			const relPath = path.relative(claudeDir, file);
			if (FILE_WHITELIST.has(relPath.split(path.sep).join("/"))) continue;
			if (isInWhitelistedSkill(relPath.split(path.sep).join("/"))) continue;

			const content = fs.readFileSync(file, "utf-8");
			const lines = content.split("\n");
			for (let i = 0; i < lines.length; i++) {
				const tokens = extractTokens(lines[i]);
				for (const token of tokens) {
					if (isAllowed(token, allowed)) continue;
					if (isAllowed(token, reserved)) {
						findings.push({
							file: relPath,
							line: i + 1,
							token,
							level: "WARN",
							reason: "Reserved future path — not yet on allowlist",
						});
						continue;
					}
					findings.push({
						file: relPath,
						line: i + 1,
						token,
						level: "ERROR",
						reason: "Not on Type-1 allowlist — internal-doc leak or unrecognized path",
					});
				}
			}
		}
	}

	const errorCount = findings.filter((f) => f.level === "ERROR").length;
	const warnCount = findings.filter((f) => f.level === "WARN").length;
	return { scannedFiles, findings, errorCount, warnCount };
}

export function formatReport(result: DocsRefResult): string {
	if (result.notApplicable) {
		return `N/A: docs-reference contract not present at ${CONTRACT_REL_PATH} — source-repo-only maintainer document, nothing to check in this project.`;
	}
	const lines: string[] = [];
	for (const f of result.findings) {
		lines.push(`${f.file}:${f.line}: ${f.level}: ${f.token} — ${f.reason}`);
	}
	lines.push(`\nScanned ${result.scannedFiles} files. ${result.errorCount} error(s), ${result.warnCount} warning(s).`);
	return lines.join("\n");
}
