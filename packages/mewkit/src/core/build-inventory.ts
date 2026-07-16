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

export const DEPENDENCY_EDGE_TYPES = [
	"requires",
	"peer",
	"optional_bridge",
	"redirect",
	"consumes_artifact",
	"human_handoff",
	"provider_adapter",
] as const;
export type DependencyEdgeType = (typeof DEPENDENCY_EDGE_TYPES)[number];

export interface DependencyEdge {
	id: string;
	type: DependencyEdgeType;
}

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
	/** Typed dependency graph metadata; preserves edge semantics for future consumers. */
	dependencyEdges?: DependencyEdge[];
	/** Flat compatibility projection used by existing pack closure and validation. */
	dependsOn?: string[];
	/** Vendor-neutral substrate responsibility (optional; seed + tag-on-touch). */
	responsibility?: string;
	/** Optional implementation-surface cross-reference (7-surface lens). */
	surface?: string;
	/** Agent-only model declaration from canonical frontmatter. */
	model?: string;
	/** Agent-only comma-delimited tool allowlist from canonical frontmatter. */
	tools?: string[];
	/** Generated agent-contract classification; never a hand-maintained roster. */
	agentClass?: "core-support" | "domain" | "intelligence" | "internal";
	/** Generated entry route used by the agent-contract inventory views. */
	routing?: "direct-only" | "hub-only" | "harness";
	/** Whether the agent can be invoked outside its internal executor path. */
	public?: boolean;
	/** Agent-only owned paths/patterns parsed from its ownership declaration. */
	ownedArtifacts?: string[];
	/** Agent-only trigger/negative-boundary declaration derived from description. */
	triggerOwner?: boolean;
	/** Agent-only status-protocol declaration. */
	statusReference?: "a1" | "none";
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

function dependencyEdges(meta: Record<string, unknown>, issues: InventoryIssue[], artifactPath: string): DependencyEdge[] {
	if (!Array.isArray(meta.dependency_edges)) return [];
	const edges: DependencyEdge[] = [];
	const typesById = new Map<string, DependencyEdgeType>();
	for (const [index, raw] of meta.dependency_edges.entries()) {
		const edge = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
		if (!edge || typeof edge.id !== "string" || !edge.id.trim() || typeof edge.type !== "string" || !DEPENDENCY_EDGE_TYPES.includes(edge.type as DependencyEdgeType)) {
			issues.push({ path: artifactPath, type: "unknown", problem: `invalid dependency_edges[${index}]` });
			continue;
		}
		const type = edge.type as DependencyEdgeType;
		const priorType = typesById.get(edge.id);
		if (priorType && priorType !== type) {
			issues.push({ path: artifactPath, type: "unknown", problem: `conflicting dependency_edges types for "${edge.id}"` });
			continue;
		}
		typesById.set(edge.id, type);
		if (!priorType) edges.push({ id: edge.id, type });
	}
	return edges;
}

function agentContractFields(id: string): Pick<InventoryEntry, "agentClass" | "routing" | "public"> {
	if (id === "advisor") return { agentClass: "internal", routing: "harness", public: false };
	if (id === "story-sizer") return { agentClass: "intelligence", routing: "direct-only", public: true };
	if (id.startsWith("jira-") || id.startsWith("confluence-")) {
		return { agentClass: "domain", routing: "hub-only", public: true };
	}
	return { agentClass: "core-support", routing: "direct-only", public: true };
}

function agentDeclaredArtifacts(body: string): string[] {
	const heading = /^## (?:Exclusive|Artifact) Ownership\s*$/m.exec(body);
	const ownership = heading ? body.slice((heading.index ?? 0) + heading[0].length).split(/^## /m, 1)[0] : body;
	return [...ownership.matchAll(/`([^`]+)`/g)]
		.map((match) => match[1])
		.filter((value) => value.includes("/") && !value.startsWith("mk:"));
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
		const edges = dependencyEdges(meta, allIssues, ref.rel);
		if (edges.length > 0) entry.dependencyEdges = edges;
		const legacy = Array.isArray(meta.depends_on) ? meta.depends_on.filter((id): id is string => typeof id === "string") : [];
		const typedRequires = edges.filter((edge) => edge.type === "requires").map((edge) => edge.id);
		if (edges.length > 0 && legacy.length > 0) {
			const legacyIds = new Set(legacy);
			const typedIds = new Set(typedRequires);
			const matches = legacyIds.size === typedIds.size && [...legacyIds].every((id) => typedIds.has(id));
			if (!matches) {
				allIssues.push({ path: ref.rel, type: ref.type, problem: "depends_on must match dependency_edges of type requires" });
			}
		}
		const flattened = [...new Set(edges.length > 0 ? typedRequires : legacy)];
		if (flattened.length > 0) entry.dependsOn = flattened;
		if (typeof meta.responsibility === "string") entry.responsibility = meta.responsibility;
		if (typeof meta.surface === "string") entry.surface = meta.surface;
		if (ref.type === "agent") {
			const body = fs.readFileSync(ref.abs, "utf-8");
			entry.model = str(meta.model);
			entry.tools = str(meta.tools)
				.split(",")
				.map((tool) => tool.trim())
				.filter(Boolean);
			Object.assign(entry, agentContractFields(ref.id));
			entry.ownedArtifacts = agentDeclaredArtifacts(body);
			entry.triggerOwner = /\b(?:use|runs?|activated|auto-activates|invoked|routed)\b/i.test(str(meta.description)) && /\b(?:not|never|does not)\b/i.test(str(meta.description));
			entry.statusReference = body.includes("End with the A1 status block exactly as defined in `.claude/rules/agent-conduct.md` (A1).") ? "a1" : "none";
		}
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
		if (e.type === "agent") {
			if (!e.model) problems.push("missing model");
			if (!e.tools || e.tools.length === 0) problems.push("missing tools");
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
