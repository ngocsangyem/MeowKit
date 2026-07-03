// Vendored from claudekit-cli (MIT). Source: src/commands/portable/config-discovery.ts (discoverConfig only)
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { PortableItem } from "../types.js";

export async function discoverConfig(configPath: string): Promise<PortableItem | null> {
	if (!existsSync(configPath)) return null;

	const content = await readFile(configPath, "utf-8");
	return {
		name: "CLAUDE",
		description: "Project configuration",
		type: "config",
		sourcePath: configPath,
		frontmatter: {},
		body: content,
	};
}

// --- Keys-only .env discovery ---------------------------------------------
//
// SECURITY (injection-rules Rule 4/5): a `.env` file holds SECRETS. This is the
// ONLY reader of `.claude/.env` in the migration path, and it is structurally
// incapable of carrying a value out of this module: every line is split on the
// FIRST `=`, the key is kept, and the remainder is discarded BEFORE any object
// is constructed. `EnvKeyDiscovery.keys` is `readonly string[]` — there is no
// field that could ever hold a value. The value never enters converter memory,
// is never written to any output, and is never logged.
//
// Downstream (shell-env-policy-emitter) further excludes secret-like key NAMES
// from the emitted scaffold; this reader only produces names.

/**
 * Result of scanning `.claude/.env` for key NAMES.
 *
 * The shape deliberately holds ONLY key names — there is no place for a value.
 * A unit test asserts a sentinel value from the source file is absent from
 * every field of this structure.
 */
export interface EnvKeyDiscovery {
	/** Absolute path scanned (present even when the file has no keys) */
	sourcePath: string;
	/** Distinct key NAMES in first-seen order — never values */
	readonly keys: readonly string[];
}

/** A valid POSIX-ish env key: letters/digits/underscore, not leading with a digit. */
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Parse ONLY the key names out of `.env` text. The value side of each line is
 * split off on the first `=` and discarded immediately — it is never returned,
 * stored, or included in any structure. `export FOO=bar` and `FOO=bar` both
 * yield the key `FOO`. Blank lines, comments, and malformed keys are skipped.
 *
 * This is the input-side hard gate that makes value leakage impossible: the
 * function's return type (`readonly string[]`) cannot express a value.
 */
export function parseEnvKeyNames(content: string): string[] {
	const keys: string[] = [];
	const seen = new Set<string>();
	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq <= 0) continue;
		// Split on the FIRST `=` and DISCARD the remainder before anything else.
		let key = line.slice(0, eq).trim();
		// `line.slice(eq + 1)` (the value) is intentionally never bound.
		if (key.startsWith("export ")) key = key.slice("export ".length).trim();
		if (!ENV_KEY.test(key) || seen.has(key)) continue;
		seen.add(key);
		keys.push(key);
	}
	return keys;
}

/**
 * Discover the KEY NAMES declared in a source `.claude/.env` file. Returns null
 * when the file does not exist. Values are never read into memory beyond the
 * per-line key split (see module header).
 */
export async function discoverEnvKeys(envPath: string): Promise<EnvKeyDiscovery | null> {
	if (!existsSync(envPath)) return null;
	const content = await readFile(envPath, "utf-8");
	const keys = parseEnvKeyNames(content);
	return { sourcePath: envPath, keys };
}
