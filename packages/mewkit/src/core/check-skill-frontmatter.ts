/**
 * Validate every SKILL.md frontmatter against `.claude/schemas/skill-schema.json`.
 *
 * Two severities. An ERROR is a schema violation or a broken runtime contract and
 * fails the check. A WARN is a missing recommended or advisory field; it is
 * reported and only fails under `strict`.
 *
 * Runs on node, not in the interpreter it is partly about: the rule that a skill
 * shipping a documented `.py` must declare `requires_runtime` is worth nothing if
 * it can only be checked where Python is already installed.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { load as parseYaml } from "js-yaml";
import { validateAgainstSchema, formatViolation } from "./json-schema-lite.js";
import { RUNTIME_KEY } from "./skill-env.js";
import { documentedPythonScripts, runtimeContractErrors } from "./skill-runtime-contract.js";

/** Recommended-but-not-required fields. Missing → WARN. */
const RECOMMENDED_FIELDS = ["when_to_use"] as const;

/**
 * External-service env-var anchors that mark a SKILL.md body as an
 * external-service entrypoint. Anchored to the MEOW_/MEOWKIT_ forms, NOT a bare
 * GEMINI_API_KEY: the real key is MEOWKIT_GEMINI_API_KEY and the bare form
 * appears only inside a legacy-fallback description string.
 */
const EXTERNAL_SERVICE_PATTERNS = [
	/\bMEOW_JIRA_/,
	/\bMEOW_CONFLUENCE_/,
	/\bMEOWKIT_GEMINI_API_KEY\b/,
	/\bMEOWKIT_MINIMAX_API_KEY\b/,
];

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

export interface FrontmatterReport {
	errors: string[];
	warnings: string[];
	/** Skills that passed every check. */
	valid: number;
	/** Set when the tree could not be read at all; the caller exits 2. */
	fatal?: string;
}

type Frontmatter = Record<string, unknown>;

function isObject(value: unknown): value is Frontmatter {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * True when a skill is an external-service entrypoint: its body references an
 * external-service env var, OR its frontmatter marks a user-invocable
 * Jira/Confluence leaf.
 */
export function isExternalServiceEntrypoint(fm: Frontmatter, body: string): boolean {
	if (EXTERNAL_SERVICE_PATTERNS.some((p) => p.test(body))) return true;
	// Non-user-invocable internals are excluded from the frontmatter-marker path.
	if (fm["user-invocable"] === false) return false;
	const owner = fm.owner;
	if (owner === "jira" || owner === "confluence") return true;
	const agent = fm.agent;
	return typeof agent === "string" && (agent.startsWith("jira-") || agent.startsWith("confluence-"));
}

/** Advisory WARNs for the tool-contract fields. Never an ERROR (calibration phase). */
export function toolContractWarnings(fm: Frontmatter, body: string): string[] {
	const warns: string[] = [];
	if (isExternalServiceEntrypoint(fm, body) && !("requires_external_service" in fm)) {
		warns.push("external-service entrypoint missing 'requires_external_service'");
	}
	if ("requires_external_service" in fm && !("default_enabled" in fm)) {
		warns.push("'requires_external_service' present but 'default_enabled' missing");
	}
	return warns;
}

function skillNames(skillsRoot: string): string[] {
	return readdirSync(skillsRoot, { withFileTypes: true })
		.filter((e) => e.isDirectory() && !e.name.startsWith("."))
		.map((e) => e.name)
		.filter((name) => existsSync(path.join(skillsRoot, name, "SKILL.md")))
		.sort();
}

/** Validate every `*​/SKILL.md` under `<root>/.claude/skills`. */
export function checkSkillFrontmatter(root: string): FrontmatterReport {
	const schemaPath = path.join(root, ".claude", "schemas", "skill-schema.json");
	const skillsRoot = path.join(root, ".claude", "skills");
	if (!existsSync(schemaPath)) return { errors: [], warnings: [], valid: 0, fatal: `No schema at ${schemaPath}` };
	if (!existsSync(skillsRoot)) return { errors: [], warnings: [], valid: 0, fatal: `No skills dir at ${skillsRoot}` };

	const schema = JSON.parse(readFileSync(schemaPath, "utf-8")) as Record<string, unknown>;
	const report: FrontmatterReport = { errors: [], warnings: [], valid: 0 };

	for (const name of skillNames(skillsRoot)) {
		const skillDir = path.join(skillsRoot, name);
		const rel = path.relative(root, path.join(skillDir, "SKILL.md"));
		const text = readFileSync(path.join(skillDir, "SKILL.md"), "utf-8");
		const match = FRONTMATTER_RE.exec(text);
		if (!match) {
			report.errors.push(`${rel}: no YAML frontmatter`);
			continue;
		}

		let parsed: unknown;
		try {
			parsed = parseYaml(match[1] ?? "");
		} catch (error: unknown) {
			report.errors.push(`${rel}: YAML parse error: ${error instanceof Error ? error.message : String(error)}`);
			continue;
		}
		if (!isObject(parsed)) {
			report.errors.push(`${rel}: frontmatter is not an object`);
			continue;
		}

		// The runtime contract runs BEFORE the schema. A field confusion also trips
		// the schema's enum or pattern, and that generic message ("'python' is not
		// one of ...") is exactly the one that leaves an author guessing which of
		// the two fields they wanted.
		const contractErrors = runtimeContractErrors(parsed);
		const scripts = documentedPythonScripts(skillDir);
		if (scripts.length > 0 && !(RUNTIME_KEY in parsed)) {
			contractErrors.push(
				`ships ${scripts.slice(0, 3).join(", ")} on its documented path but declares no '${RUNTIME_KEY}'`,
			);
		}
		if (contractErrors.length > 0) {
			for (const message of contractErrors) report.errors.push(`${rel}: ${message}`);
			continue;
		}

		const violations = validateAgainstSchema(parsed, schema);
		if (violations.length > 0) {
			report.errors.push(`${rel}: ${formatViolation(violations[0]!)}`);
			continue;
		}

		for (const field of RECOMMENDED_FIELDS) {
			if (!(field in parsed)) report.warnings.push(`${rel}: recommended field '${field}' missing`);
		}
		const body = text.slice(match[0].length);
		for (const warn of toolContractWarnings(parsed, body)) report.warnings.push(`${rel}: ${warn}`);
		report.valid += 1;
	}

	return report;
}
