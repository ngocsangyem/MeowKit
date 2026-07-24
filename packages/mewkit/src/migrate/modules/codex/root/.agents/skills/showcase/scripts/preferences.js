#!/usr/bin/env node
/**
 * Showcase skill preferences helper.
 * Persists workflow opt-outs (screenshots, publishing, languages) across sessions.
 *
 * State is written to PLUGIN_DATA/showcase/preferences.json (Rule 2 — stable
 * across plugin upgrades). Falls back to ~/.cache/mewkit/showcase/preferences.json.
 *
 * Override path for tests: MK_SHOWCASE_PREFS_PATH env var.
 */
import fs from "fs/promises";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";

export const DEFAULT_PREFERENCES = Object.freeze({
	version: 1,
	screenshots: false, // default off: screenshots need Puppeteer installed
	publishing: false, // default off: local-only; see SKILL.md publish stub
	languages: Object.freeze(["en"]),
});

const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on", "enable", "enabled"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", "off", "disable", "disabled"]);
const VALID_LANGUAGES = new Set(["en", "vi"]);

/**
 * Resolve preferences file path.
 * Priority: MK_SHOWCASE_PREFS_PATH > PLUGIN_DATA/showcase > fallback cache dir.
 */
export function resolvePreferencesPath(env = process.env) {
	if (env.MK_SHOWCASE_PREFS_PATH) return path.resolve(env.MK_SHOWCASE_PREFS_PATH);
	const dataBase = env.PLUGIN_DATA
		? path.join(env.PLUGIN_DATA, "showcase")
		: path.join(os.homedir(), ".cache", "mewkit", "showcase");
	return path.join(dataBase, "preferences.json");
}

function parseBoolean(value, flagName) {
	if (typeof value === "boolean") return value;
	if (value === undefined || value === null) {
		throw new Error(`${flagName} requires on/off, true/false, or yes/no`);
	}
	const normalized = String(value).trim().toLowerCase();
	if (TRUE_VALUES.has(normalized)) return true;
	if (FALSE_VALUES.has(normalized)) return false;
	throw new Error(`${flagName} received invalid boolean value: ${value}`);
}

function parseLanguages(value) {
	if (Array.isArray(value)) return normalizeLanguages(value);
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error("--languages requires en, vi, or en,vi");
	}
	return normalizeLanguages(value.split(",").map((item) => item.trim()));
}

function normalizeLanguages(languages) {
	const unique = [];
	for (const raw of languages) {
		const lang = String(raw).trim().toLowerCase();
		if (!VALID_LANGUAGES.has(lang)) {
			throw new Error(`Unsupported language "${raw}". Use en, vi, or en,vi.`);
		}
		if (!unique.includes(lang)) unique.push(lang);
	}
	if (unique.length === 0) throw new Error("At least one language is required");
	return unique;
}

export function normalizePreferences(input = {}) {
	const merged = { ...DEFAULT_PREFERENCES, ...input };
	return {
		version: 1,
		screenshots: parseBoolean(merged.screenshots, "screenshots"),
		publishing: parseBoolean(merged.publishing, "publishing"),
		languages: parseLanguages(merged.languages),
	};
}

export async function loadPreferences({ env = process.env } = {}) {
	const preferencesPath = resolvePreferencesPath(env);
	try {
		const raw = await fs.readFile(preferencesPath, "utf8");
		const parsed = JSON.parse(raw);
		return { path: preferencesPath, exists: true, preferences: normalizePreferences(parsed), warnings: [] };
	} catch (error) {
		if (error.code === "ENOENT") {
			return {
				path: preferencesPath,
				exists: false,
				preferences: normalizePreferences(DEFAULT_PREFERENCES),
				warnings: [],
			};
		}
		return {
			path: preferencesPath,
			exists: true,
			preferences: normalizePreferences(DEFAULT_PREFERENCES),
			warnings: [`Could not read preferences; using defaults. ${error.message}`],
		};
	}
}

export async function savePreferences(preferences, { env = process.env } = {}) {
	const preferencesPath = resolvePreferencesPath(env);
	const normalized = normalizePreferences(preferences);
	const payload = { ...normalized, updatedAt: new Date().toISOString() };
	const dir = path.dirname(preferencesPath);
	const tmpPath = `${preferencesPath}.${process.pid}.${Date.now()}.tmp`;

	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
	await fs.rename(tmpPath, preferencesPath);

	return { path: preferencesPath, preferences: payload };
}

export async function resetPreferences({ env = process.env } = {}) {
	const preferencesPath = resolvePreferencesPath(env);
	try {
		await fs.unlink(preferencesPath);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	return { path: preferencesPath, preferences: normalizePreferences(DEFAULT_PREFERENCES) };
}

export function parseSetArgs(argv) {
	const updates = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--no-screenshots") {
			updates.screenshots = false;
			continue;
		}
		if (arg === "--screenshots") {
			updates.screenshots = parseBoolean(argv[++i], "--screenshots");
			continue;
		}
		if (arg === "--no-publishing" || arg === "--no-publish") {
			updates.publishing = false;
			continue;
		}
		if (arg === "--publishing" || arg === "--publish") {
			updates.publishing = parseBoolean(argv[++i], arg);
			continue;
		}
		if (arg === "--no-dual-language") {
			updates.languages = ["en"];
			continue;
		}
		if (arg === "--dual-language") {
			updates.languages = parseBoolean(argv[++i], "--dual-language") ? ["vi", "en"] : ["en"];
			continue;
		}
		if (arg === "--language" || arg === "--languages") {
			updates.languages = parseLanguages(argv[++i]);
			continue;
		}
		throw new Error(`Unknown option: ${arg}`);
	}
	return updates;
}

function withDerivedFields(result) {
	return {
		success: true,
		...result,
		preferences: { ...result.preferences, dualLanguage: result.preferences.languages.length > 1 },
	};
}

function writeJson(data) {
	process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}
function writeError(error) {
	process.stderr.write(`${JSON.stringify({ success: false, error: error.message }, null, 2)}\n`);
}

export async function main(argv = process.argv.slice(2), { env = process.env } = {}) {
	const command = argv[0] || "get";

	if (command === "path") {
		writeJson({ success: true, path: resolvePreferencesPath(env) });
		return;
	}
	if (command === "get") {
		writeJson(withDerivedFields(await loadPreferences({ env })));
		return;
	}
	if (command === "set") {
		const loaded = await loadPreferences({ env });
		const updates = parseSetArgs(argv.slice(1));
		const saved = await savePreferences({ ...loaded.preferences, ...updates }, { env });
		writeJson(withDerivedFields({ ...saved, exists: true, warnings: loaded.warnings || [] }));
		return;
	}
	if (command === "reset") {
		writeJson(withDerivedFields(await resetPreferences({ env })));
		return;
	}
	throw new Error(`Unknown command: ${command}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		writeError(error);
		process.exit(1);
	});
}
