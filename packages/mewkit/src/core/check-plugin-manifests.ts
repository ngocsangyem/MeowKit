// Plugin guardrails for `mewkit validate` — encode the failure modes that bit
// the upstream plugin migration so they cannot silently regress:
//   1. Namespace purity (source) — agent `name:` stay bare (else they would
//      double-prefix to `mk:mk:*` under a plugin), skill `name:` stay `mk:`-scoped
//      (catch a stray non-`mk:` leak), and every `subagent_type` ref resolves to a
//      real kit agent or a built-in.
//   2. Plugin-manifest contract — the generated manifests exist, parse, name `mk`,
//      and carry required fields.
//   3. Version alignment — generated manifest versions equal the root package
//      version (only enforced when the plugin payload has been generated).
import fs from "node:fs";
import path from "node:path";
import type { CheckResult } from "../commands/validate.js";
import type { Status } from "./../commands/doctor-checks.js";
import { collectAgentNames, BUILTIN_AGENT_TYPES } from "./plugin-agent-refs.js";
import {
	ClaudeMarketplaceJsonSchema,
	ClaudePluginJsonSchema,
	CodexMarketplaceJsonSchema,
	CodexPluginJsonSchema,
	PLUGIN_NAME,
} from "./plugin-manifest.js";

const SECTION = "Plugin" as const;

/** Walk a directory yielding every file path. */
function* walk(dir: string): Generator<string> {
	if (!fs.existsSync(dir)) return;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(full);
		else if (entry.isFile()) yield full;
	}
}

/** Source namespace purity — agents bare, skills `mk:`, refs resolvable. */
export function checkPluginNamespace(claudeDir: string): CheckResult[] {
	const results: CheckResult[] = [];
	const agentNames = collectAgentNames(path.join(claudeDir, "agents"));

	// Agent names must be bare (no `:`) — the plugin runtime adds the `mk:` prefix.
	const prefixedAgents = [...agentNames].filter((n) => n.includes(":"));
	results.push({
		name: "Agent names are bare",
		status: prefixedAgents.length === 0 ? "pass" : "fail",
		detail:
			prefixedAgents.length === 0
				? `${agentNames.size} agents, none namespaced (plugin auto-prefixes)`
				: `would double-prefix under plugin: ${prefixedAgents.join(", ")}`,
		section: SECTION,
	});

	// Skill names must be `mk:`-scoped (catch a non-`mk:` namespace leak).
	const skillsDir = path.join(claudeDir, "skills");
	const leaked: string[] = [];
	if (fs.existsSync(skillsDir)) {
		for (const dirent of fs.readdirSync(skillsDir, { withFileTypes: true })) {
			if (!dirent.isDirectory()) continue;
			const skillFile = path.join(skillsDir, dirent.name, "SKILL.md");
			if (!fs.existsSync(skillFile)) continue;
			const m = fs.readFileSync(skillFile, "utf-8").match(/^name:\s*["']?([^"'\r\n]+)/m);
			if (m && !m[1].trim().startsWith(`${PLUGIN_NAME}:`)) leaked.push(`${dirent.name} → ${m[1].trim()}`);
		}
	}
	results.push({
		name: "Skill names are mk:-scoped",
		status: leaked.length === 0 ? "pass" : "fail",
		detail: leaked.length === 0 ? "no namespace leaks" : `non-mk: skill names: ${leaked.join("; ")}`,
		section: SECTION,
	});

	// Every subagent_type ref must resolve to a kit agent or a built-in.
	const allowed = new Set<string>([...agentNames, ...BUILTIN_AGENT_TYPES]);
	const stray: string[] = [];
	const refRe = /subagent_type\s*[:=]\s*["']?([A-Za-z][A-Za-z0-9-]*)/g;
	for (const file of walk(skillsDir)) {
		if (!/\.(md|sh|cjs|mjs|js|ts|py)$/.test(file)) continue;
		const text = fs.readFileSync(file, "utf-8");
		let match: RegExpExecArray | null;
		while ((match = refRe.exec(text)) !== null) {
			const ref = match[1];
			if (!allowed.has(ref) && !ref.startsWith(`${PLUGIN_NAME}:`)) {
				stray.push(`${path.relative(claudeDir, file)} → ${ref}`);
			}
		}
	}
	results.push({
		name: "subagent_type refs resolve",
		status: stray.length === 0 ? "pass" : "warn",
		detail: stray.length === 0 ? "all refs are kit agents or built-ins" : `unknown refs: ${stray.slice(0, 5).join("; ")}`,
		section: SECTION,
	});

	return results;
}

/** Generated-manifest contract + version alignment (N/A until generated). */
export function checkPluginManifests(projectRoot: string): CheckResult[] {
	const pluginDir = path.join(projectRoot, "plugin");
	if (!fs.existsSync(pluginDir)) {
		return [
			{
				name: "Plugin distribution",
				status: "na",
				detail: "plugin/ not generated — run `mewkit build-plugin`",
				section: SECTION,
			},
		];
	}

	const expectedVersion = readRootVersion(projectRoot);
	const manifests: { label: string; file: string; schema: { parse: (v: unknown) => unknown }; name?: string; version?: boolean }[] = [
		{ label: "Claude plugin.json", file: "plugin/.claude-plugin/plugin.json", schema: ClaudePluginJsonSchema, name: PLUGIN_NAME, version: true },
		{ label: "Codex plugin.json", file: "plugin/.codex-plugin/plugin.json", schema: CodexPluginJsonSchema, name: PLUGIN_NAME, version: true },
		{ label: "Claude marketplace.json", file: ".claude-plugin/marketplace.json", schema: ClaudeMarketplaceJsonSchema },
		{ label: "Codex marketplace.json", file: ".agents/plugins/marketplace.json", schema: CodexMarketplaceJsonSchema },
	];

	const results: CheckResult[] = [];
	for (const m of manifests) {
		const full = path.join(projectRoot, m.file);
		if (!fs.existsSync(full)) {
			results.push({ name: m.label, status: "fail", detail: `missing: ${m.file}`, section: SECTION });
			continue;
		}
		let parsed: Record<string, unknown>;
		try {
			parsed = m.schema.parse(JSON.parse(fs.readFileSync(full, "utf-8"))) as Record<string, unknown>;
		} catch (err) {
			results.push({ name: m.label, status: "fail", detail: `invalid: ${(err as Error).message.split("\n")[0]}`, section: SECTION });
			continue;
		}
		const issues: string[] = [];
		if (m.name && parsed.name !== m.name) issues.push(`name=${String(parsed.name)} (want ${m.name})`);
		if (m.version && expectedVersion && parsed.version !== expectedVersion) {
			issues.push(`version=${String(parsed.version)} (want ${expectedVersion})`);
		}
		results.push({
			name: m.label,
			status: issues.length === 0 ? "pass" : "fail",
			detail: issues.length === 0 ? "valid" : issues.join(", "),
			section: SECTION,
		});
	}
	return results;
}

function readRootVersion(projectRoot: string): string | null {
	try {
		const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8")) as {
			version?: string;
		};
		return pkg.version ?? null;
	} catch {
		return null;
	}
}

/** Combined plugin section: namespace purity + manifest contract. */
export function checkPlugin(claudeDir: string, projectRoot: string): CheckResult[] {
	return [...checkPluginNamespace(claudeDir), ...checkPluginManifests(projectRoot)];
}

export type { Status };
