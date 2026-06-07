import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { findRuntimeCouplingMatches } from "./runtime-coupling-patterns.js";
import { isBinaryContent } from "./reconcile/checksum-utils.js";
import type { ProviderType } from "./types.js";

export interface SkillDirectoryAuditIssue {
	filePath: string;
	message: string;
}

export interface SkillDirectoryAuditResult {
	errors: SkillDirectoryAuditIssue[];
}

export interface SkillDirectoryAuditOptions {
	ignoreRewriteableMarkdown?: boolean;
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

function shouldScanFile(filePath: string, size: number): boolean {
	if (size > MAX_TEXT_FILE_BYTES) return false;
	return TEXT_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function isHighRiskFile(filePath: string): boolean {
	const base = filePath.split("/").pop()?.toLowerCase() ?? "";
	return EXECUTABLE_EXTENSIONS.has(extname(filePath).toLowerCase()) || base === "skill.md";
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

export async function auditSkillDirectory(
	rootDir: string,
	provider: ProviderType,
	skillName: string,
	options: SkillDirectoryAuditOptions = {},
): Promise<SkillDirectoryAuditResult> {
	if (provider === "claude-code") return { errors: [] };

	const errors: SkillDirectoryAuditIssue[] = [];
	for (const filePath of await collectFiles(rootDir)) {
		const info = await stat(filePath);
		if (!shouldScanFile(filePath, info.size)) continue;

		const buffer = await readFile(filePath);
		if (isBinaryContent(buffer)) continue;

		const content = buffer.toString("utf-8");
		const relativePath = relative(rootDir, filePath).replace(/\\/g, "/");
		if (options.ignoreRewriteableMarkdown && isMarkdownFile(relativePath)) continue;

		for (const match of findRuntimeCouplingMatches(content)) {
			const severity = isHighRiskFile(relativePath) ? "high-risk" : "runtime-coupled";
			errors.push({
				filePath: relativePath,
				message: `${provider} skill/${skillName} ${severity} file ${relativePath} ${match.message}`,
			});
		}
	}

	return { errors };
}
