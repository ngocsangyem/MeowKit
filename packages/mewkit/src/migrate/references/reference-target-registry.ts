// Single source of truth for rewriting source-runtime references
// (`.claude/<type>/...`, `CLAUDE.md`) to provider target paths. All mapping
// strings and source patterns live HERE — converters must consume this module
// instead of holding their own literals (guarded by a unit test).

import { homedir } from "node:os";
import { providers } from "../provider-registry.js";
import type { ProviderType } from "../types.js";

/** Portable-type keys that have a per-provider target path */
export type ReferenceTargetType = "agents" | "commands" | "skills" | "rules" | "config" | "hooks";

export type ReferenceScope = "project" | "global";

export interface ReferenceTarget {
	/** Normalized target path; ends with "/" when it is a directory */
	path: string;
	isDirectory: boolean;
}

export interface ReferenceRewriteRule {
	type: ReferenceTargetType;
	/** Source path prefix this rule matches (e.g. ".claude/agents/") */
	sourcePrefix: string;
	/** Resolved provider target, or null when the provider has no such surface */
	target: ReferenceTarget | null;
	/** Special-case suffix mapping (e.g. Codex command → skill directory filename) */
	resolveSuffix?: (suffix: string) => string;
}

/** Root of the source runtime tree. The only place this literal may appear. */
export const SOURCE_ROOT = ".claude/";

/** Source config filename token */
export const SOURCE_CONFIG_TOKEN = "CLAUDE.md";

const DIRECTORY_TYPES: ReferenceTargetType[] = ["agents", "commands", "skills", "rules", "hooks"];

export function sourcePrefixForType(type: ReferenceTargetType): string {
	return type === "config" ? SOURCE_CONFIG_TOKEN : `${SOURCE_ROOT}${type}/`;
}

function normalizeTargetPath(path: string): string {
	const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
	const home = homedir().replace(/\\/g, "/");
	return normalized.startsWith(home) ? normalized.replace(home, "~") : normalized;
}

/**
 * Resolve the provider target for one portable type. Mirrors the historical
 * md-strip resolution exactly: prefer the scope's path, fall back to the other.
 */
export function getReferenceTarget(
	provider: ProviderType | undefined,
	type: ReferenceTargetType,
	scope: ReferenceScope = "project",
): ReferenceTarget | null {
	if (!provider) return null;
	const pathConfig = providers[provider][type];
	if (!pathConfig) return null;
	const resolvedPath =
		scope === "global"
			? (pathConfig.globalPath ?? pathConfig.projectPath)
			: (pathConfig.projectPath ?? pathConfig.globalPath);
	if (!resolvedPath) return null;

	const normalized = normalizeTargetPath(resolvedPath);
	const isDirectory = pathConfig.writeStrategy === "per-file";

	return {
		path: isDirectory && !normalized.endsWith("/") ? `${normalized}/` : normalized,
		isDirectory,
	};
}

/** Build the full rewrite table for one provider (one rule per portable type). */
export function buildReferenceRewriteTable(
	provider: ProviderType | undefined,
	scope: ReferenceScope = "project",
): ReferenceRewriteRule[] {
	const types: ReferenceTargetType[] = [...DIRECTORY_TYPES, "config"];
	return types.map((type) => {
		const rule: ReferenceRewriteRule = {
			type,
			sourcePrefix: sourcePrefixForType(type),
			target: getReferenceTarget(provider, type, scope),
		};
		return rule;
	});
}

/**
 * Resolve one source path (e.g. ".claude/skills/x/run.py") against a rewrite
 * table. Returns the rewritten target path, or null when unmapped.
 */
export function resolveReferenceTarget(table: ReferenceRewriteRule[], sourcePath: string): string | null {
	const normalized = sourcePath.replace(/\\/g, "/");
	for (const rule of table) {
		if (rule.type === "config") {
			if (normalized === rule.sourcePrefix) return rule.target?.path ?? null;
			continue;
		}
		if (!normalized.toLowerCase().startsWith(rule.sourcePrefix.toLowerCase())) continue;
		if (!rule.target) return null;
		const suffix = normalized.slice(rule.sourcePrefix.length);
		if (rule.resolveSuffix && rule.target.isDirectory && suffix) {
			return `${rule.target.path}${rule.resolveSuffix(suffix)}`;
		}
		return rule.target.isDirectory ? `${rule.target.path}${suffix}` : rule.target.path;
	}
	return null;
}

// --- Source patterns ------------------------------------------------------
// Regexes matching source references. Kept as factory functions so every
// caller gets fresh lastIndex state for the global flags.

/** Any `.claude/<path>` reference, longest path-like run captured */
export function sourceReferencePattern(): RegExp {
	return /\.claude\/[a-zA-Z0-9_./-]*/gi;
}

/** Line filter used when the provider has no hooks surface */
export function sourceHooksLinePattern(): RegExp {
	return /\.claude\/hooks\//i;
}

/** The `CLAUDE.md` token in prose */
export function sourceConfigTokenPattern(): RegExp {
	return /\bCLAUDE\.md\b/g;
}
