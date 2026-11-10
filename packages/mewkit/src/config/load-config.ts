// Read one `config.yaml` and say exactly what is wrong with it, or hand back a
// flat map of applied keys.
//
// Three stages, in this order, because each protects the next: the grammar guard
// refuses anything the hook reader could not also parse; js-yaml supplies the
// values; the rules refuse a file that parses but says something a committed
// file must not say. Nothing is applied partially — a rejected config yields
// zero keys, never the ones that happened to come before the bad one.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml, YAMLException } from "js-yaml";
import type { ConfigScope, ConfigValues, RuleError } from "./config-rules.js";
import { applyRules } from "./config-rules.js";
import { buildConfigSchema } from "./schema.js";
import { checkGrammar, flatten } from "./yaml-grammar.js";

export const CONFIG_REL = join(".meowkit", "config.yaml");

export interface ConfigFailure {
	code: string;
	/** Absent for a grammar failure, which is about a line rather than a key. */
	key?: string;
	line?: number;
	message: string;
	fix: string;
	file: string;
	scope: ConfigScope;
}

export type LoadResult = { ok: true; values: ConfigValues; present: boolean } | { ok: false; error: ConfigFailure };

/** `<root>/.meowkit/config.yaml`. */
export const projectConfigPath = (root: string): string => join(root, CONFIG_REL);

/** `~/.meowkit/config.yaml` — outside any repository, except when the repository is `$HOME`. */
export const userConfigPath = (home: string): string => join(home, CONFIG_REL);

const asFailure = (error: RuleError, file: string, scope: ConfigScope): ConfigFailure => ({ ...error, file, scope });

/**
 * Load one config file. An absent file is success with no keys: a project
 * without a config is configured by its defaults, which is not an error.
 */
export function loadConfigFile(
	file: string,
	observerNames: readonly string[],
	scope: ConfigScope = "project config",
): LoadResult {
	if (!existsSync(file)) return { ok: true, values: {}, present: false };

	let source: string;
	try {
		source = readFileSync(file, "utf8");
	} catch (err) {
		return {
			ok: false,
			error: {
				code: "unreadable",
				message: `${file} could not be read (${err instanceof Error ? err.message : String(err)})`,
				fix: "check the file's permissions",
				file,
				scope,
			},
		};
	}

	const grammar = checkGrammar(source);
	if (grammar !== null) {
		return {
			ok: false,
			error: {
				code: grammar.code,
				line: grammar.line,
				message: `${file}:${grammar.line}: ${grammar.message}`,
				fix: "the config grammar is two levels of keys with boolean, whole-number or string values",
				file,
				scope,
			},
		};
	}

	let document: unknown;
	try {
		document = parseYaml(source, { filename: file });
	} catch (err) {
		// The parser's own exception class never reaches the user: its wording is
		// about YAML internals, and what the user needs is the line and the fix.
		const line = err instanceof YAMLException && err.mark ? err.mark.line + 1 : undefined;
		return {
			ok: false,
			error: {
				code: "parse-error",
				line,
				message: `${file}${line === undefined ? "" : `:${line}`}: not valid YAML`,
				fix: "compare the file against the commented stubs the installer wrote",
				file,
				scope,
			},
		};
	}

	if (document === null || document === undefined) return { ok: true, values: {}, present: true };
	if (typeof document !== "object" || Array.isArray(document)) {
		return {
			ok: false,
			error: {
				code: "not-a-map",
				message: `${file}: the config must be a map of keys, not ${Array.isArray(document) ? "a list" : typeof document}`,
				fix: "write `key: value` lines at the top level",
				file,
				scope,
			},
		};
	}

	const flat = flatten(document);
	const ruled = applyRules(flat, observerNames, scope);
	if (!ruled.ok) return { ok: false, error: asFailure(ruled.error, file, scope) };

	// The zod schema is the shape of record; the flat rules above are what
	// produces a message naming one key. Running both means a shape the rules
	// somehow let through is still refused rather than applied.
	const shaped = buildConfigSchema(observerNames, scope === "user config" ? "user" : "project").safeParse(document);
	if (!shaped.success) {
		const issue = shaped.error.issues[0];
		const key = issue?.path.join(".") ?? "";
		return {
			ok: false,
			error: {
				code: "schema-violation",
				key,
				message: `${file}: ${key === "" ? "" : `${key}: `}${issue?.message ?? "does not match the config schema"}`,
				fix: "check the key against the commented stubs the installer wrote",
				file,
				scope,
			},
		};
	}

	return { ok: true, values: ruled.values, present: true };
}
