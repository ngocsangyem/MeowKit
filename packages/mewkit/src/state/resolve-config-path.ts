// Where the project config lives: `<root>/.meowkit/config.yaml`, committed,
// human-owned and schema-validated.
//
// There is exactly one reader path and no fallback. The file this replaced —
// `.meowkit/config.json`, and before that `.claude/meowkit.config.json` — was an
// install descriptor rather than a preference file, so a reader that silently
// accepted either would be reading two different kinds of document. A project
// that still carries only the old descriptor is MIGRATION-PENDING: `upgrade`
// snapshots it, carries every value with an equivalent across and names the
// rest. Reporting that state is the job of the callers below; guessing at it
// here, by quietly reading whichever file happens to exist, is what left a
// project unsure which file was in force.
import { existsSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_BASENAME = "config.yaml";
/** The v2 install descriptor the committed config replaced. */
export const LEGACY_DESCRIPTOR_REL = join(".meowkit", "config.json");
/** The pre-move location of that same descriptor. */
export const LEGACY_CLAUDE_DESCRIPTOR_REL = join(".claude", "meowkit.config.json");

/** `<root>/.meowkit/config.yaml` — the only config path, for readers and writers alike. */
export function configWritePath(projectRoot: string): string {
	return join(projectRoot, ".meowkit", CONFIG_BASENAME);
}

/** The old descriptor this project still has, if any — canonical first. */
export function legacyDescriptorPath(projectRoot: string): string | null {
	for (const rel of [LEGACY_DESCRIPTOR_REL, LEGACY_CLAUDE_DESCRIPTOR_REL]) {
		const file = join(projectRoot, rel);
		if (existsSync(file)) return file;
	}
	return null;
}

/** True when the project has the old descriptor and not yet the committed config. */
export function migrationPending(projectRoot: string): boolean {
	return !existsSync(configWritePath(projectRoot)) && legacyDescriptorPath(projectRoot) !== null;
}
