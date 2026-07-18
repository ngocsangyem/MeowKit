import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { findRuntimeCouplingMatches, type RuntimeCouplingMatch } from "./runtime-coupling-patterns.js";
import { detectStateChanging, languageFor } from "./state-changing-script-detector.js";
import { isBinaryContent } from "./reconcile/checksum-utils.js";
import type { ReferenceOccurrence } from "./references/reference-types.js";
import type { ProviderType } from "./types.js";

export interface SkillDirectoryAuditIssue {
	filePath: string;
	message: string;
}

/**
 * A runtime-coupling match that was downgraded from fail-closed to warn+annotate
 * (reference-grade markdown, or a table-rewriteable pattern in a non-state-changing
 * script). Every waiver is a structured record — never a silent absence.
 */
export interface SkillDirectoryAuditWaiver {
	filePath: string;
	/** Pattern class message, e.g. "contains a Claude-specific environment variable". */
	message: string;
	/** Provider-neutral annotation describing what was rewritten/neutralized. */
	annotation: string;
}

export interface SkillDirectoryAuditResult {
	errors: SkillDirectoryAuditIssue[];
	/** Downgraded matches (warn, not fail). Empty when nothing was downgraded. */
	waivers: SkillDirectoryAuditWaiver[];
}

export interface SkillDirectoryAuditOptions {
	ignoreRewriteableMarkdown?: boolean;
	/** Classifier decisions per rewritten markdown file (relative path) */
	occurrencesByFile?: Map<string, ReferenceOccurrence[]>;
}

const MAX_TEXT_FILE_BYTES = 512 * 1024;
const EXECUTABLE_EXTENSIONS = new Set([".sh", ".py", ".js", ".cjs", ".mjs", ".ts"]);
const TEXT_EXTENSIONS = new Set([
	"",
	".md",
	".mdx",
	".txt",
	".json",
	".jsonc",
	".yaml",
	".yml",
	".toml",
	".sh",
	".py",
	".js",
	".cjs",
	".mjs",
	".ts",
	".tsx",
	".css",
	".html",
	".xml",
]);

type FileClass = "entry" | "reference" | "script" | "other";

function shouldScanFile(filePath: string, size: number): boolean {
	if (size > MAX_TEXT_FILE_BYTES) return false;
	return TEXT_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function classifyFile(relativePath: string): FileClass {
	const base = relativePath.split("/").pop()?.toLowerCase() ?? "";
	const ext = extname(relativePath).toLowerCase();
	if (EXECUTABLE_EXTENSIONS.has(ext)) return "script";
	if (base === "skill.md") return "entry";
	if (ext === ".md" || ext === ".mdx") return "reference";
	return "other";
}

function isMarkdownFile(filePath: string): boolean {
	const extension = extname(filePath).toLowerCase();
	return extension === ".md" || extension === ".mdx";
}

async function collectFiles(rootDir: string): Promise<string[]> {
	const files: string[] = [];
	const entries = await readdir(rootDir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = join(rootDir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await collectFiles(fullPath)));
		} else if (entry.isFile()) {
			files.push(fullPath);
		}
	}
	return files;
}

type Verdict = { kind: "fail"; message: string } | { kind: "warn"; message: string; annotation: string };

/**
 * Severity-aware, per-pattern verdict. This is where the LOCKED script policy and
 * the reference-grade downgrade live:
 *
 *   - Reference-grade markdown (references/*.md, non-entry docs): every runtime
 *     coupling downgrades to warn+annotate. Markdown never executes.
 *   - Entry markdown (SKILL.md): env-var patterns are table-rewriteable (a safe
 *     static lookup) → warn+annotate; CLI/path/config patterns downgrade to warn
 *     too, because a markdown doc line is not runnable. (High-risk == a runnable
 *     *script*, not the fact of being SKILL.md.)
 *   - Scripts: if the whole script is state-changing AND carries ANY coupling
 *     match → FAIL-CLOSED for every match (a rewrite never downgrades it). A
 *     non-state-changing script rewrites known env-var patterns (warn+annotate),
 *     else warn+preserve — per the locked policy.
 */
function verdictFor(
	match: RuntimeCouplingMatch,
	fileClass: FileClass,
	scriptIsStateChanging: boolean,
	stateChangingReason: string | undefined,
): Verdict {
	if (fileClass === "script" && scriptIsStateChanging) {
		return {
			kind: "fail",
			message:
				`${match.message} (state-changing script ${stateChangingReason ?? ""}; fail-closed — no rewrite path downgrades it)`.trimEnd(),
		};
	}

	if (match.cls === "claude-env-var" && match.rewrite) {
		const detail = match.rewrite.disposition === "rewrite" ? "rewritten" : "neutralized";
		return { kind: "warn", message: `${match.message} (${detail})`, annotation: match.rewrite.annotation };
	}

	// Non-env patterns (CLI, .claude/ path, CLAUDE.md token).
	if (fileClass === "reference" || fileClass === "entry") {
		return {
			kind: "warn",
			message: `${match.message} (documentation reference)`,
			annotation: `${match.message}; preserved in migrated docs — adapt manually for the target runtime`,
		};
	}
	// Non-state-changing script, non-rewriteable pattern → warn + preserve.
	return {
		kind: "warn",
		message: `${match.message} (preserved)`,
		annotation: `${match.message}; left unchanged (no safe portable rewrite) — adapt manually for the target runtime`,
	};
}

export async function auditSkillDirectory(
	rootDir: string,
	provider: ProviderType,
	skillName: string,
	options: SkillDirectoryAuditOptions = {},
): Promise<SkillDirectoryAuditResult> {
	if (provider === "claude-code") return { errors: [], waivers: [] };

	const errors: SkillDirectoryAuditIssue[] = [];
	const waivers: SkillDirectoryAuditWaiver[] = [];
	for (const filePath of await collectFiles(rootDir)) {
		const info = await stat(filePath);
		if (!shouldScanFile(filePath, info.size)) continue;

		const buffer = await readFile(filePath);
		if (isBinaryContent(buffer)) continue;

		const content = buffer.toString("utf-8");
		const relativePath = relative(rootDir, filePath).replace(/\\/g, "/");
		if (options.ignoreRewriteableMarkdown && isMarkdownFile(relativePath)) continue;

		const fileClass = classifyFile(relativePath);
		const stateChange =
			fileClass === "script" ? detectStateChanging(content, languageFor(relativePath)) : { stateChanging: false };

		const occurrences = options.occurrencesByFile?.get(relativePath) ?? [];
		for (const match of findRuntimeCouplingMatches(content, occurrences)) {
			const verdict = verdictFor(match, fileClass, stateChange.stateChanging, stateChange.reason);
			const severity = fileClass === "script" || fileClass === "entry" ? "high-risk" : "runtime-coupled";
			if (verdict.kind === "fail") {
				errors.push({
					filePath: relativePath,
					message: `${provider} skill/${skillName} ${severity} file ${relativePath} ${verdict.message}`,
				});
			} else {
				waivers.push({ filePath: relativePath, message: verdict.message, annotation: verdict.annotation });
			}
		}
	}

	return { errors, waivers };
}
