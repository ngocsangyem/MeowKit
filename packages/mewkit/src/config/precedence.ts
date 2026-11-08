// Which level answered, and why that order.
//
//   environment override > CLI flag > project config > user config > default
//
// The environment sits at the top for exactly one key. `MEOWKIT_TDD` is one of
// only two sources that can turn strict test-first mode ON, so demoting it below
// a committed file would let `tdd: false` in a pull request switch an enforcement
// mode off for everyone, silently. Every other behaviour toggle has no
// environment form at all — that is the point of having one committed file.
//
// The resolver reports the answering level alongside the value. A user asking
// "why is this on?" is asking which file to edit, and a bare value cannot say.
import { homedir } from "node:os";
import type { ConfigValues } from "./config-rules.js";
import type { ConfigFailure } from "./load-config.js";
import { loadConfigFile, projectConfigPath, userConfigPath } from "./load-config.js";

export type Level = "env" | "flag" | "project" | "user" | "default";

/**
 * Environment names that keep overriding their config key. Exactly one
 * qualifies, and it is named in the repository's classification table under the
 * class that exists for it, rather than special-cased in code.
 */
export const ENV_OVERRIDES: Record<string, string> = { tdd: "MEOWKIT_TDD" };

const TRUTHY = new Set(["1", "true", "yes", "on", "enable", "enabled"]);
const FALSY = new Set(["0", "false", "no", "off", "disable", "disabled"]);

/** Interpret an override's raw string, or `undefined` when it says nothing. */
export function envBoolean(raw: string | undefined): boolean | undefined {
	if (raw === undefined || raw === "") return undefined;
	const text = raw.trim().toLowerCase();
	if (TRUTHY.has(text)) return true;
	if (FALSY.has(text)) return false;
	return undefined;
}

export interface ResolveOptions {
	root: string;
	observerNames: readonly string[];
	env?: NodeJS.ProcessEnv;
	home?: string;
	/** Values a command-line flag supplied, keyed the same way as the config. */
	flags?: ConfigValues;
}

export interface Resolved {
	values: ConfigValues;
	levels: Record<string, Level>;
	/** Every scope that failed to load, in load order. Never thrown. */
	errors: ConfigFailure[];
}

/**
 * Merge the levels into one answer per key. A failing scope contributes no keys
 * and one error: an invalid file must not half-apply, and must not stop the
 * caller either, because an observer with a broken config still has to run.
 */
export function resolveConfig(options: ResolveOptions): Resolved {
	const { root, observerNames, env = process.env, home = homedir(), flags = {} } = options;
	const values: ConfigValues = {};
	const levels: Record<string, Level> = {};
	const errors: ConfigFailure[] = [];

	const assign = (source: ConfigValues, level: Level): void => {
		for (const [key, value] of Object.entries(source)) {
			if (key === "$schema") continue;
			values[key] = value;
			levels[key] = level;
		}
	};

	const user = loadConfigFile(userConfigPath(home), observerNames, "user config");
	if (user.ok) assign(user.values, "user");
	else errors.push(user.error);

	const project = loadConfigFile(projectConfigPath(root), observerNames, "project config");
	if (project.ok) assign(project.values, "project");
	else errors.push(project.error);

	assign(flags, "flag");

	for (const [key, name] of Object.entries(ENV_OVERRIDES)) {
		const override = envBoolean(env[name]);
		if (override === undefined) continue;
		values[key] = override;
		levels[key] = "env";
	}

	return { values, levels, errors };
}

/** One key's resolved value and the level that answered it. */
export function configValue<T extends boolean | number | string>(
	key: string,
	fallback: T,
	options: ResolveOptions,
): { value: T; level: Level } {
	const { values, levels } = resolveConfig(options);
	if (!Object.hasOwn(values, key)) return { value: fallback, level: "default" };
	return { value: values[key] as T, level: levels[key] as Level };
}
