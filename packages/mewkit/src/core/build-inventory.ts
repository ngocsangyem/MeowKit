import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { CheckResult } from "../commands/validate.js";
import type { Status } from "../commands/doctor-checks.js";

// The unified harness inventory. Every skill, agent, rule, command, and hook,
// merged with its governance metadata from the hybrid store: frontmatter for
// skills + agents, the central registry (.claude/harness-inventory.json) for
// rules + commands + hooks. This is the single enumeration authority — the
// stale-index check imports `enumerateArtifacts` from here and never re-derives
// "what counts", so doc counts reconcile with reality by construction.

export type ArtifactType = "skill" | "agent" | "rule" | "command" | "hook";

/** Frozen contract — the stale-index check consumes this shape. */
export interface InventoryEntry {
	type: ArtifactType;
	path: string; // relative to .claude/
	id: string;
	owner: string;
	criticality: string;
	status: string;
	runtime: string;
	contextCost?: string;
	dependsOn?: string[];
	/** Vendor-neutral substrate responsibility (optional; seed + tag-on-touch). */
	responsibility?: string;
	/** Optional implementation-surface cross-reference (7-surface lens). */
	surface?: string;
	source: "frontmatter" | "registry";
}

/** A structural or metadata problem surfaced honestly rather than skipped. */
export interface InventoryIssue {
	path: string; // relative to .claude/ (or a dir for unknown-dir issues)
	type: ArtifactType | "unknown";
	problem: string;
}

export interface Inventory {
	entries: InventoryEntry[];
	issues: InventoryIssue[];
}

/** Runtime/tooling dirs that are never harness artifacts. */
const DENYLIST_DIRS = new Set([".venv", "__pycache__", "node_modules"]);

const REQUIRED_FIELDS = ["owner", "criticality", "status", "runtime"] as const;

interface ArtifactRef {
	type: ArtifactType;
	rel: string; // relative to .claude/
	abs: string;
	id: string;
	metaSource: "frontmatter" | "registry";
}

function listMarkdown(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
}

/**
 * The canonical "what counts" enumeration. Returns artifact references plus any
 * structural anomalies (e.g. a skill subdir with no SKILL.md that is not a known
 * runtime dir). Counting is presence-based; rules and rules-conditional are
 * deliberately NOT merged — callers label them as separate buckets.
 */
export function enumerateArtifacts(claudeDir: string): { refs: ArtifactRef[]; issues: InventoryIssue[] } {
	const refs: ArtifactRef[] = [];
	const issues: InventoryIssue[] = [];

	// skills — subdirs containing SKILL.md
	const skillsDir = path.join(claudeDir, "skills");
	if (fs.existsSync(skillsDir)) {
		for (const entry of fs.readdirSync(skillsDir)) {
			if (DENYLIST_DIRS.has(entry)) continue;
			const subdir = path.join(skillsDir, entry);
			if (!fs.statSync(subdir).isDirectory()) continue;
			const skillMd = path.join(subdir, "SKILL.md");
			if (fs.existsSync(skillMd)) {
				const fm = readFrontmatter(skillMd);
				const id = typeof fm.name === "string" ? fm.name : entry;
				refs.push({ type: "skill", rel: `skills/${entry}/SKILL.md`, abs: skillMd, id, metaSource: "frontmatter" });
			} else {
				issues.push({ path: `skills/${entry}`, type: "unknown", problem: "skill directory has no SKILL.md (not a known runtime dir)" });
			}
		}
	}

	// agents — *.md excluding *_INDEX.md
	const agentsDir = path.join(claudeDir, "agents");
	for (const f of listMarkdown(agentsDir)) {
		if (f.endsWith("_INDEX.md")) continue;
		refs.push({ type: "agent", rel: `agents/${f}`, abs: path.join(agentsDir, f), id: f.replace(/\.md$/, ""), metaSource: "frontmatter" });
	}

	// rules + rules-conditional — separate buckets, registry-sourced
	for (const f of listMarkdown(path.join(claudeDir, "rules"))) {
		refs.push({ type: "rule", rel: `rules/${f}`, abs: path.join(claudeDir, "rules", f), id: f.replace(/\.md$/, ""), metaSource: "registry" });
	}
	for (const f of listMarkdown(path.join(claudeDir, "rules-conditional"))) {
		refs.push({ type: "rule", rel: `rules-conditional/${f}`, abs: path.join(claudeDir, "rules-conditional", f), id: f.replace(/\.md$/, ""), metaSource: "registry" });
	}

	// commands — commands/mk/*.md, registry-sourced
	const cmdDir = path.join(claudeDir, "commands", "mk");
	for (const f of listMarkdown(cmdDir)) {
		refs.push({ type: "command", rel: `commands/mk/${f}`, abs: path.join(cmdDir, f), id: f.replace(/\.md$/, ""), metaSource: "registry" });
	}

	// hooks — isHookScript-true files, registry-sourced
	const hooksDir = path.join(claudeDir, "hooks");
	if (fs.existsSync(hooksDir)) {
		for (const f of fs.readdirSync(hooksDir)) {
			const abs = path.join(hooksDir, f);
			if (!fs.statSync(abs).isFile()) continue;
			if (!f.endsWith(".sh")) continue; // top-level shell hooks are the counted set
			refs.push({ type: "hook", rel: `hooks/${f}`, abs, id: f.replace(/\.sh$/, ""), metaSource: "registry" });
		}
	}

	return { refs, issues };
}

/** Extract the YAML frontmatter block of a markdown file, or {} if none. */
export function readFrontmatter(abs: string): Record<string, unknown> {
	try {
		const body = fs.readFileSync(abs, "utf-8");
		const m = /^---\n([\s\S]*?)\n---/.exec(body);
		if (!m) return {};
		const parsed = yaml.load(m[1]);
		return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

interface RegistryShape {
	artifacts?: Record<string, Record<string, unknown>>;
}

/** Read the central registry for rules/commands/hooks. */
export function readRegistry(claudeDir: string): Record<string, Record<string, unknown>> {
	const regPath = path.join(claudeDir, "harness-inventory.json");
	if (!fs.existsSync(regPath)) return {};
	try {
		const parsed = JSON.parse(fs.readFileSync(regPath, "utf-8")) as RegistryShape;
		return parsed.artifacts ?? {};
	} catch {
		return {};
	}
}

function str(v: unknown): string {
	return typeof v === "string" ? v : "";
}

/**
 * Build the unified inventory. Each artifact's metadata comes from frontmatter
 * (skills/agents) or the registry (rules/commands/hooks). Missing records and
 * missing required fields are recorded as issues — never silently defaulted to
 * a passing value.
 */
export function buildInventory(claudeDir: string): Inventory {
	const { refs, issues } = enumerateArtifacts(claudeDir);
	const registry = readRegistry(claudeDir);
	const entries: InventoryEntry[] = [];
	const allIssues: InventoryIssue[] = [...issues];

	for (const ref of refs) {
		const meta: Record<string, unknown> =
			ref.metaSource === "frontmatter" ? readFrontmatter(ref.abs) : registry[ref.rel] ?? {};

		const hasRecord = ref.metaSource === "frontmatter" ? Object.keys(meta).length > 0 : ref.rel in registry;
		if (!hasRecord) {
			allIssues.push({ path: ref.rel, type: ref.type, problem: `no governance metadata (${ref.metaSource})` });
		}

		const entry: InventoryEntry = {
			type: ref.type,
			path: ref.rel,
			id: ref.id,
			owner: str(meta.owner),
			criticality: str(meta.criticality),
			status: str(meta.status),
			runtime: str(meta.runtime),
			source: ref.metaSource,
		};
		if (typeof meta.context_cost === "string") entry.contextCost = meta.context_cost;
		if (Array.isArray(meta.depends_on)) entry.dependsOn = meta.depends_on.map(String);
		if (typeof meta.responsibility === "string") entry.responsibility = meta.responsibility;
		if (typeof meta.surface === "string") entry.surface = meta.surface;
		entries.push(entry);
	}

	// Registry keys that point at no enumerated artifact (stale registry entry).
	const enumerated = new Set(refs.map((r) => r.rel));
	for (const key of Object.keys(registry)) {
		if (!enumerated.has(key)) {
			allIssues.push({ path: key, type: "unknown", problem: "registry entry has no matching artifact on disk" });
		}
	}

	return { entries, issues: allIssues };
}

interface SchemaEnums {
	owner: Set<string>;
	criticality: Set<string>;
	status: Set<string>;
	runtime: Set<string>;
}

/** Load the allowed-enum sets from the governance schema (single source). */
export function loadSchemaEnums(claudeDir: string): SchemaEnums | null {
	const schemaPath = path.join(claudeDir, "schemas", "harness-metadata-schema.json");
	if (!fs.existsSync(schemaPath)) return null;
	try {
		const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8")) as {
			properties?: Record<string, { enum?: string[] }>;
		};
		const props = schema.properties ?? {};
		return {
			owner: new Set(props.owner?.enum ?? []),
			criticality: new Set(props.criticality?.enum ?? []),
			status: new Set(props.status?.enum ?? []),
			runtime: new Set(props.runtime?.enum ?? []),
		};
	} catch {
		return null;
	}
}

/**
 * Ownership-completeness validation. FAILS when any artifact lacks a metadata
 * record, is missing a required field, or carries an out-of-enum value, or when
 * a structural anomaly exists (unknown dir, stale registry entry). PASSES only
 * when every discovered artifact is 100% covered with valid values.
 */
export function checkOwnership(claudeDir: string, opts: { missingInfraSeverity?: Status } = {}): CheckResult[] {
	// The governance schema is the install signal: absent ⇒ the metadata layer
	// is not installed. In a non-scoped run that downgrades to WARN (prompt the
	// upgrade); the scoped `--ownership` CI check keeps it a hard FAIL.
	const schemaPath = path.join(claudeDir, "schemas", "harness-metadata-schema.json");
	if (!fs.existsSync(schemaPath)) {
		const status: Status = opts.missingInfraSeverity ?? "fail";
		const detail =
			status === "warn"
				? "Ownership metadata not installed (no harness-metadata-schema.json) — run `mewkit upgrade`"
				: "Missing/unreadable .claude/schemas/harness-metadata-schema.json";
		return [{ name: "Governance metadata installed", status, detail, section: "Ownership" }];
	}
	const enums = loadSchemaEnums(claudeDir);
	if (!enums) {
		return [{ name: "Governance schema loads", status: "fail", detail: "Unreadable .claude/schemas/harness-metadata-schema.json", section: "Ownership" }];
	}

	const { entries, issues } = buildInventory(claudeDir);
	const results: CheckResult[] = [];

	for (const issue of issues) {
		results.push({ name: `Ownership: ${issue.path}`, status: "fail", detail: `${issue.type}: ${issue.problem}`, section: "Ownership" });
	}

	const enumOf: Record<(typeof REQUIRED_FIELDS)[number], Set<string>> = {
		owner: enums.owner,
		criticality: enums.criticality,
		status: enums.status,
		runtime: enums.runtime,
	};

	for (const e of entries) {
		const problems: string[] = [];
		for (const field of REQUIRED_FIELDS) {
			const value = e[field];
			if (!value) {
				problems.push(`missing ${field}`);
			} else if (!enumOf[field].has(value)) {
				problems.push(`${field}="${value}" not in enum`);
			}
		}
		if (problems.length > 0) {
			results.push({ name: `Ownership: ${e.path}`, status: "fail", detail: problems.join("; "), section: "Ownership" });
		}
	}

	const failed = results.filter((r) => r.status === "fail").length;
	results.push({
		name: "Ownership coverage",
		status: failed === 0 ? "pass" : "fail",
		detail: failed === 0 ? `${entries.length} artifacts, 100% governance coverage` : `${failed} artifact(s) with missing/invalid metadata`,
		section: "Ownership",
	});

	return results;
}
