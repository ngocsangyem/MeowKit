// Emits a Codex `[shell_environment_policy]` scaffold from `.claude/.env` KEY
// NAMES ONLY. Codex's documented analogue for passing environment into shell
// subprocesses is `[shell_environment_policy]` with `inherit` / `set` /
// `exclude` / `include_only` (source: https://developers.openai.com/codex/config-advanced).
//
// SECURITY (injection-rules Rule 4/5): this emitter receives ONLY key names
// (from discoverEnvKeys, the single keys-only reader). It never sees a value.
// Two further guarantees hold here:
//   1. Every emitted `set` entry uses the inert placeholder "<fill-me>", so a
//      committed config.toml leaks nothing.
//   2. Key NAMES matching a secret-name pattern are EXCLUDED from the scaffold
//      AND from the report — only an aggregate count is surfaced, with a pointer
//      to Codex's env-injection docs, so the user is nudged toward OS-level /
//      env-file injection rather than pasting secrets into config.toml.

import type { EnvKeyDiscovery } from "../../discovery/config-discovery.js";

/** Inert placeholder — committing config.toml with this leaks nothing. */
const PLACEHOLDER = "<fill-me>";

/**
 * Secret-name pattern (case-insensitive). A key whose NAME matches is treated
 * as sensitive and never written into the scaffold. This is a NAME heuristic —
 * values are never available to this module regardless.
 */
const SECRET_NAME_PATTERN = /(SECRET|TOKEN|PASSWORD|PASS|API_KEY|KEY|CREDENTIAL)/i;

/** Codex doc for `[shell_environment_policy]` and env injection. */
const CONFIG_ADVANCED_DOC = "https://developers.openai.com/codex/config-advanced";

export interface ShellEnvPolicyScaffold {
	/**
	 * TOML `[shell_environment_policy]` scaffold text (empty string when no
	 * non-secret keys remain to scaffold). Contains ONLY inert placeholders.
	 */
	content: string;
	/** Non-secret key NAMES included in the scaffold, in input order. */
	includedKeys: string[];
	/** Aggregate count of secret-like key NAMES omitted from scaffold AND report. */
	omittedSecretCount: number;
	/** Advisory/warning lines for the migration report (never contain values). */
	warnings: string[];
}

/** True when a key NAME looks like it holds a secret. Name-only heuristic. */
export function isSecretLikeKey(key: string): boolean {
	return SECRET_NAME_PATTERN.test(key);
}

/**
 * Quote a bare env key for use as a TOML bare-or-quoted key. Valid bare keys
 * (letters/digits/underscore/dash) are emitted bare; anything else is quoted.
 * Ambiguous names are quoted (fail-closed), never dropped or guessed.
 */
function tomlKey(key: string): string {
	return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

/**
 * Build the `[shell_environment_policy]` scaffold from discovered KEY NAMES.
 *
 * Secret-like names are excluded entirely (scaffold + report); only an aggregate
 * count survives. All included entries use the inert `<fill-me>` placeholder.
 * When no discovery exists (no `.claude/.env`), returns an empty scaffold.
 */
export function emitShellEnvPolicyScaffold(discovery: EnvKeyDiscovery | null): ShellEnvPolicyScaffold {
	const warnings: string[] = [];
	if (!discovery || discovery.keys.length === 0) {
		return { content: "", includedKeys: [], omittedSecretCount: 0, warnings };
	}

	const includedKeys: string[] = [];
	let omittedSecretCount = 0;
	for (const key of discovery.keys) {
		if (isSecretLikeKey(key)) {
			omittedSecretCount += 1;
			continue;
		}
		includedKeys.push(key);
	}

	if (omittedSecretCount > 0) {
		// Aggregate only — no key NAMES, no values. Pointer to env-injection docs.
		warnings.push(
			`${omittedSecretCount} secret-like key(s) omitted from the shell_environment_policy scaffold — ` +
				`inject secrets via your OS/environment, not config.toml. See ${CONFIG_ADVANCED_DOC}`,
		);
	}

	if (includedKeys.length === 0) {
		// Nothing safe to scaffold; caller still sees the omitted-count warning.
		return { content: "", includedKeys, omittedSecretCount, warnings };
	}

	const lines: string[] = [
		"# [shell_environment_policy] scaffold generated from source .claude/.env KEY NAMES.",
		`# Codex passes environment to shell subprocesses via this table (inherit/set/exclude/include_only).`,
		`# Reference: ${CONFIG_ADVANCED_DOC}`,
		"#",
		`# ⚠ do NOT commit real values into config.toml. The placeholders below are inert (${PLACEHOLDER}).`,
		"# Fill each value from your environment, or prefer inherit/OS-level injection for secrets.",
		"# Secret-like key names (SECRET/TOKEN/PASSWORD/PASS/API_KEY/KEY/CREDENTIAL) were intentionally omitted.",
		"[shell_environment_policy]",
		"set = {",
	];
	for (const key of includedKeys) {
		lines.push(`  ${tomlKey(key)} = ${JSON.stringify(PLACEHOLDER)},`);
	}
	lines.push("}");

	return { content: lines.join("\n") + "\n", includedKeys, omittedSecretCount, warnings };
}

export const SHELL_ENV_POLICY_PLACEHOLDER = PLACEHOLDER;
export const SHELL_ENV_POLICY_ANTI_COMMIT_WARNING = "⚠ do NOT commit real values into config.toml";
