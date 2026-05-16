import fs from "node:fs";
import path from "node:path";

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
	"rules-conditional",
	"modes",
	"benchmarks",
];

// Files allowed to mention banned paths (because they DEFINE the bans).
const FILE_WHITELIST = new Set([
	"rules/docs-reference-contract.md",
	"rules/skill-authoring-rules.md",
]);

// Skill dirs whose Grep-of-user-project semantics need an opt-out from path checks.
const SKILL_DIR_WHITELIST = new Set([
	"skills/docs-finder",
]);

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
			if (
				entry.name === "node_modules" ||
				entry.name === ".venv" ||
				entry.name === "tests" ||
				entry.name === "__pycache__"
			) continue;
			walkMd(full, out);
		} else if (
			entry.isFile() &&
			(entry.name.endsWith(".md") || entry.name.endsWith(".sh") || entry.name.endsWith(".py") || entry.name.endsWith(".cjs") || entry.name.endsWith(".js"))
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
	const contractPath = path.join(claudeDir, "rules", "docs-reference-contract.md");
	if (!fs.existsSync(contractPath)) {
		throw new Error(`Contract file missing: ${contractPath}`);
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
	const lines: string[] = [];
	for (const f of result.findings) {
		lines.push(`${f.file}:${f.line}: ${f.level}: ${f.token} — ${f.reason}`);
	}
	lines.push(
		`\nScanned ${result.scannedFiles} files. ${result.errorCount} error(s), ${result.warnCount} warning(s).`
	);
	return lines.join("\n");
}
