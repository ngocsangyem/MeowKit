// Vendored from claudekit-cli (MIT). Source: src/commands/migrate/migrate-scope-resolver.ts
// Pure logic — no I/O. Resolves which content types to migrate from CLI flags.

export interface MigrateScopeOptions {
	config?: boolean;
	rules?: boolean;
	hooks?: boolean;
	skipConfig?: boolean;
	skipRules?: boolean;
	skipHooks?: boolean;
	only?: string;
}

export interface MigrationScope {
	agents: boolean;
	commands: boolean;
	skills: boolean;
	config: boolean;
	rules: boolean;
	hooks: boolean;
}

const ALL_TYPES = ["agents", "commands", "skills", "config", "rules", "hooks"] as const;
type ScopeType = (typeof ALL_TYPES)[number];

function parseOnly(only: string | undefined): Set<ScopeType> | null {
	if (!only) return null;
	const parts = only
		.split(",")
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	const set = new Set<ScopeType>();
	for (const part of parts) {
		if ((ALL_TYPES as readonly string[]).includes(part)) set.add(part as ScopeType);
	}
	return set;
}

export function resolveMigrationScope(
	argv: string[],
	options: MigrateScopeOptions,
): MigrationScope {
	const argSet = new Set(argv);

	const onlySet = parseOnly(options.only);
	if (onlySet && onlySet.size > 0) {
		const skipConflict =
			options.skipConfig === true ||
			options.skipRules === true ||
			options.skipHooks === true ||
			argSet.has("--skip-config") ||
			argSet.has("--skip-rules") ||
			argSet.has("--skip-hooks") ||
			argSet.has("--no-config") ||
			argSet.has("--no-rules") ||
			argSet.has("--no-hooks");
		if (skipConflict) {
			throw new Error("--only is mutually exclusive with --skip-* flags");
		}
		return {
			agents: onlySet.has("agents"),
			commands: onlySet.has("commands"),
			skills: onlySet.has("skills"),
			config: onlySet.has("config"),
			rules: onlySet.has("rules"),
			hooks: onlySet.has("hooks"),
		};
	}

	const hasConfigArg = argSet.has("--config");
	const hasRulesArg = argSet.has("--rules");
	const hasHooksArg = argSet.has("--hooks");
	const hasAgentsArg = argSet.has("--agents");
	const hasCommandsArg = argSet.has("--commands");
	const hasSkillsArg = argSet.has("--skills");
	const hasNoConfigArg = argSet.has("--no-config") || argSet.has("--skip-config");
	const hasNoRulesArg = argSet.has("--no-rules") || argSet.has("--skip-rules");
	const hasNoHooksArg = argSet.has("--no-hooks") || argSet.has("--skip-hooks");

	// "Only" mode: any positive --type flag was specified
	const hasOnlyFlag =
		hasConfigArg ||
		hasRulesArg ||
		hasHooksArg ||
		hasAgentsArg ||
		hasCommandsArg ||
		hasSkillsArg;

	const skipConfig = hasNoConfigArg || options.skipConfig === true || options.config === false;
	const skipRules = hasNoRulesArg || options.skipRules === true || options.rules === false;
	const skipHooks = hasNoHooksArg || options.skipHooks === true || options.hooks === false;

	if (hasOnlyFlag) {
		return {
			agents: hasAgentsArg,
			commands: hasCommandsArg,
			skills: hasSkillsArg,
			config: hasConfigArg && !skipConfig,
			rules: hasRulesArg && !skipRules,
			hooks: hasHooksArg && !skipHooks,
		};
	}

	return {
		agents: true,
		commands: true,
		skills: true,
		config: !skipConfig,
		rules: !skipRules,
		hooks: !skipHooks,
	};
}
