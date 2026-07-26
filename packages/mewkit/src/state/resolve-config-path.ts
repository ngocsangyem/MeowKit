// Where the project config lives. Canonical is `.meowkit/config.json`, beside the rest of the
// runtime-neutral state, because the config is MeowKit's own and not a provider artifact —
// `.claude/settings.json` and `.mcp.json` stay where they are precisely because Claude Code
// reads those, not us.
//
// An install created before the move keeps its `.claude/meowkit.config.json` working: reads
// fall back to it, so upgrading the CLI does not orphan a project's settings. Writers always
// target the canonical path, so the next `init`/`upgrade` migrates the file forward.
import { existsSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_BASENAME = "config.json";
export const LEGACY_CONFIG_REL = join(".claude", "meowkit.config.json");

/** Canonical write target: `<root>/.meowkit/config.json`. */
export function configWritePath(projectRoot: string): string {
	return join(projectRoot, ".meowkit", CONFIG_BASENAME);
}

/** The config a reader should use: canonical when present, else the pre-move location. */
export function resolveConfigPath(projectRoot: string): string {
	const canonical = configWritePath(projectRoot);
	if (existsSync(canonical)) return canonical;
	const legacy = join(projectRoot, LEGACY_CONFIG_REL);
	if (existsSync(legacy)) return legacy;
	return canonical; // absent either way — report against the path we would create
}

/** True when the project is still served by the pre-move config location. */
export function usingLegacyConfig(projectRoot: string): boolean {
	return !existsSync(configWritePath(projectRoot)) && existsSync(join(projectRoot, LEGACY_CONFIG_REL));
}
