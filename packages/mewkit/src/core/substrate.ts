import fs from "node:fs";
import path from "node:path";
import { buildInventory, type InventoryEntry } from "./build-inventory.js";
import type { CheckResult } from "../commands/validate.js";
import type { Status } from "../commands/doctor-checks.js";

// The responsibility substrate. Aggregates every harness artifact by the vendor-neutral
// `responsibility` it serves, so coverage is auditable by responsibility rather than by file.
// The matrix is GENERATED from the registry/frontmatter on every call — a hand-maintained map
// would lie about state. A committed view (.claude/harness-substrate.md) is regenerated via
// `inventory --substrate --emit` and drift-checked by `validate`.

/** Canonical taxonomy: 11 vendor-neutral responsibilities plus one kit-specific addition. Order
 *  is display order; `core` marks the 11 Runtime-Substrate values versus that addition. */
export const TAXONOMY: { value: string; label: string; core: boolean }[] = [
	{ value: "task-specification", label: "Task specification", core: true },
	{ value: "context-selection", label: "Context selection", core: true },
	{ value: "tool-access", label: "Tool access", core: true },
	{ value: "project-memory", label: "Project memory", core: true },
	{ value: "task-state", label: "Task state", core: true },
	{ value: "observability", label: "Observability", core: true },
	{ value: "failure-attribution", label: "Failure attribution", core: true },
	{ value: "verification", label: "Verification", core: true },
	{ value: "permissions", label: "Permissions", core: true },
	{ value: "entropy-auditing", label: "Entropy auditing", core: true },
	{ value: "intervention-recording", label: "Intervention recording", core: true },
	{ value: "gate-enforcement", label: "Gate enforcement", core: false },
];

const VIEW_PATH = "harness-substrate.md";

export type Coverage = "covered" | "partial" | "missing";

export interface ResponsibilityRow {
	value: string;
	label: string;
	core: boolean;
	coverage: Coverage;
	count: number; // total tagged
	active: number; // tagged AND status=active
	examples: string[]; // up to 3 artifact ids
}

export interface SubstrateAggregate {
	rows: ResponsibilityRow[];
	/** Artifacts whose responsibility value is not in the taxonomy enum (always a problem). */
	invalid: { path: string; value: string }[];
	/** Registry-sourced artifacts with no responsibility (a hard gap — registry is the seeded set). */
	untaggedRegistry: string[];
	/** Frontmatter-sourced artifacts (skills/agents) with no responsibility (allowed; tag-on-touch). */
	untaggedFrontmatter: string[];
	totalArtifacts: number;
}

/** Load the allowed responsibility values from the schema; fall back to the taxonomy. */
export function loadResponsibilityEnum(claudeDir: string): Set<string> {
	const schemaPath = path.join(claudeDir, "schemas", "harness-metadata-schema.json");
	try {
		const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8")) as {
			properties?: { responsibility?: { enum?: string[] } };
		};
		const en = schema.properties?.responsibility?.enum;
		if (Array.isArray(en) && en.length > 0) return new Set(en);
	} catch {
		/* fall through */
	}
	return new Set(TAXONOMY.map((t) => t.value));
}

function coverageOf(count: number, active: number): Coverage {
	if (count === 0) return "missing";
	if (active === 0) return "partial"; // served only by deprecated/experimental artifacts
	return "covered";
}

/** Build the responsibility×coverage aggregate from the live inventory. */
export function aggregateSubstrate(claudeDir: string): SubstrateAggregate {
	const { entries } = buildInventory(claudeDir);
	const allowed = loadResponsibilityEnum(claudeDir);

	const byResp = new Map<string, InventoryEntry[]>();
	const invalid: { path: string; value: string }[] = [];
	const untaggedRegistry: string[] = [];
	const untaggedFrontmatter: string[] = [];

	for (const e of entries) {
		const r = e.responsibility;
		if (!r) {
			if (e.source === "registry") untaggedRegistry.push(e.path);
			else untaggedFrontmatter.push(e.path);
			continue;
		}
		if (!allowed.has(r)) {
			invalid.push({ path: e.path, value: r });
			continue;
		}
		const list = byResp.get(r) ?? [];
		list.push(e);
		byResp.set(r, list);
	}

	const rows: ResponsibilityRow[] = TAXONOMY.map((t) => {
		const list = byResp.get(t.value) ?? [];
		const active = list.filter((e) => e.status === "active").length;
		return {
			value: t.value,
			label: t.label,
			core: t.core,
			coverage: coverageOf(list.length, active),
			count: list.length,
			active,
			examples: list.slice(0, 3).map((e) => e.id),
		};
	});

	return {
		rows,
		invalid,
		untaggedRegistry,
		untaggedFrontmatter,
		totalArtifacts: entries.length,
	};
}

/** Deterministic markdown view — generated, never hand-edited. Stable ordering keeps the
 *  regenerate-and-diff drift check clean. */
export function renderSubstrateView(agg: SubstrateAggregate): string {
	const icon: Record<Coverage, string> = { covered: "✅ covered", partial: "🟡 partial", missing: "⬜ missing" };
	const lines: string[] = [];
	lines.push("<!-- GENERATED by `mewkit inventory --substrate --emit` — DO NOT EDIT BY HAND. -->");
	lines.push("<!-- Regenerate after tagging; `mewkit validate` fails if this drifts from the registry. -->");
	lines.push("");
	lines.push("# Harness Responsibility Substrate");
	lines.push("");
	lines.push(
		"Coverage of each vendor-neutral substrate responsibility, generated from the harness registry " +
			"+ artifact frontmatter. Eleven core values are the Runtime-Substrate taxonomy (repo-harness " +
			"synthesis, Runtime-Substrate-rooted); `Gate enforcement` is the kit-specific addition.",
	);
	lines.push("");
	lines.push("| Responsibility | Coverage | Tagged | Active | Examples |");
	lines.push("| -------------- | -------- | -----: | -----: | -------- |");
	for (const r of agg.rows) {
		const label = r.core ? r.label : `${r.label} *(kit)*`;
		lines.push(`| ${label} | ${icon[r.coverage]} | ${r.count} | ${r.active} | ${r.examples.join(", ") || "—"} |`);
	}
	lines.push("");
	const missing = agg.rows.filter((r) => r.coverage === "missing").map((r) => r.label);
	lines.push(
		`**Coverage:** ${agg.rows.filter((r) => r.coverage === "covered").length}/${agg.rows.length} responsibilities have active artifacts.` +
			(missing.length ? ` Missing: ${missing.join(", ")}.` : ""),
	);
	lines.push(
		`**Untagged:** ${agg.untaggedRegistry.length} registry + ${agg.untaggedFrontmatter.length} frontmatter ` +
			`artifacts carry no responsibility (frontmatter is tag-on-touch; registry should be 100%).`,
	);
	return lines.join("\n");
}

/** Validate substrate tagging + the committed view's freshness. Registry untagged / out-of-enum
 *  / stale-view are FAIL; frontmatter untagged is WARN (tag-on-touch, reported not hidden). */
export function checkSubstrate(claudeDir: string, opts: { missingViewSeverity?: Status } = {}): CheckResult[] {
	const section = "Substrate" as const;
	const results: CheckResult[] = [];
	const agg = aggregateSubstrate(claudeDir);

	for (const inv of agg.invalid) {
		results.push({ name: `Substrate: ${inv.path}`, status: "fail", detail: `responsibility="${inv.value}" not in taxonomy enum`, section });
	}
	for (const p of agg.untaggedRegistry) {
		results.push({ name: `Substrate: ${p}`, status: "fail", detail: "registry artifact has no responsibility (seed it)", section });
	}
	if (agg.untaggedFrontmatter.length > 0) {
		results.push({
			name: "Substrate: untagged frontmatter artifacts",
			status: "warn",
			detail: `${agg.untaggedFrontmatter.length} skill/agent artifact(s) untagged — tag-on-touch (allowed, reported).`,
			section,
		});
	}

	// View freshness: regenerate and diff against the committed file.
	const viewPath = path.join(claudeDir, VIEW_PATH);
	const fresh = renderSubstrateView(agg);
	if (!fs.existsSync(viewPath)) {
		const status: Status = opts.missingViewSeverity ?? "fail";
		results.push({
			name: "Substrate view present",
			status,
			detail:
				status === "warn"
					? "No .claude/harness-substrate.md — run `mewkit inventory --substrate --emit`"
					: "Missing .claude/harness-substrate.md (run `mewkit inventory --substrate --emit`)",
			section,
		});
	} else {
		const committed = fs.readFileSync(viewPath, "utf-8");
		const inSync = committed.trim() === fresh.trim();
		results.push({
			name: "Substrate view in sync",
			status: inSync ? "pass" : "fail",
			detail: inSync ? viewPath : "harness-substrate.md is stale — run `mewkit inventory --substrate --emit`",
			section,
		});
	}

	const fails = results.filter((r) => r.status === "fail").length;
	results.push({
		name: "Substrate coverage",
		status: fails === 0 ? "pass" : "fail",
		detail:
			fails === 0
				? `${agg.totalArtifacts} artifacts; ${agg.rows.filter((r) => r.coverage === "covered").length}/${agg.rows.length} responsibilities covered`
				: `${fails} substrate issue(s)`,
		section,
	});
	return results;
}

/** Write/refresh the committed view from the live registry. Returns the absolute path. */
export function emitSubstrateView(claudeDir: string): string {
	const viewPath = path.join(claudeDir, VIEW_PATH);
	fs.writeFileSync(viewPath, renderSubstrateView(aggregateSubstrate(claudeDir)) + "\n");
	return viewPath;
}
