import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { CURATED_STORES, type StoreSpec } from "./schemas.js";

const require = createRequire(import.meta.url);

export type IssueLevel = "error" | "warn";

export interface Issue {
	level: IssueLevel;
	message: string;
}

export interface StoreResult {
	file: string;
	exists: boolean;
	entryCount: number;
	issues: Issue[];
}

export interface ValidationReport {
	stores: StoreResult[];
	errorCount: number;
	warnCount: number;
}

export interface ContentValidator {
	(text: string): { valid: boolean; pattern?: string; match?: string };
}

// Load the real validate-content.cjs (DRY — never reimplement the injection
// patterns) from the project that owns this memory dir. Absent → recheck skipped.
export function loadContentValidator(memoryDir: string): ContentValidator | null {
	const projectRoot = path.resolve(memoryDir, "..", "..");
	const libPath = path.join(projectRoot, ".claude", "hooks", "lib", "validate-content.cjs");
	if (!fs.existsSync(libPath)) return null;
	try {
		const mod = require(libPath) as { validateContent?: ContentValidator };
		return typeof mod.validateContent === "function" ? mod.validateContent : null;
	} catch {
		return null;
	}
}

// Count `## ` section headings in a topic MD file — proxy for entry count, used
// only for the advisory MD↔JSON divergence warning.
function countMdSections(mdPath: string): number {
	if (!fs.existsSync(mdPath)) return 0;
	const content = fs.readFileSync(mdPath, "utf-8");
	const headings = content.match(/^## /gm);
	return headings ? headings.length : 0;
}

function validateStore(memoryDir: string, spec: StoreSpec, contentValidator: ContentValidator | null): StoreResult {
	const filePath = path.join(memoryDir, spec.file);
	const result: StoreResult = { file: spec.file, exists: fs.existsSync(filePath), entryCount: 0, issues: [] };

	if (!result.exists) {
		// Missing curated store is a soft state (CP-4): warn, never fail.
		result.issues.push({ level: "warn", message: `${spec.file} not found` });
		return result;
	}

	let raw: unknown;
	try {
		raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
	} catch (err) {
		result.issues.push({ level: "error", message: `invalid JSON: ${(err as Error).message}` });
		return result;
	}

	const parsed = spec.schema.safeParse(raw);
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			result.issues.push({ level: "error", message: `${issue.path.join(".") || "<root>"}: ${issue.message}` });
		}
		return result;
	}

	const data = parsed.data as Record<string, unknown>;
	const items = (data[spec.itemsKey] as Array<Record<string, unknown>>) ?? [];
	result.entryCount = items.length;

	// Per-field injection recheck — catches entries captured before the
	// write-path guard existed (CP-7 defense-in-depth).
	if (contentValidator) {
		for (const item of items) {
			const id = String(item.id ?? "<unknown>");
			for (const field of spec.textFields) {
				const text = item[field];
				if (typeof text !== "string") continue;
				const check = contentValidator(text);
				if (!check.valid) {
					result.issues.push({
						level: "warn",
						message: `entry ${id}.${field} matched injection pattern (${check.match ?? check.pattern})`,
					});
				}
			}
		}
	}

	// Advisory MD↔JSON divergence: empty JSON store while its topic MD has entries
	// signals a missing seed (knowledge would be invisible to JSON-first readers).
	const mdName = spec.file.replace(/\.json$/, ".md");
	const mdSections = countMdSections(path.join(memoryDir, mdName));
	if (result.entryCount === 0 && mdSections > 0) {
		result.issues.push({
			level: "warn",
			message: `${spec.file} is empty but ${mdName} has ${mdSections} section(s) — run 'mewkit memory seed-from-md'`,
		});
	}

	return result;
}

export function validateMemory(memoryDir: string): ValidationReport {
	const contentValidator = loadContentValidator(memoryDir);
	const stores = CURATED_STORES.map((spec) => validateStore(memoryDir, spec, contentValidator));
	let errorCount = 0;
	let warnCount = 0;
	for (const s of stores) {
		for (const issue of s.issues) {
			if (issue.level === "error") errorCount++;
			else warnCount++;
		}
	}
	return { stores, errorCount, warnCount };
}
