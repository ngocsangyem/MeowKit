// Refuses to touch a runtime that the Rust `mewkit-next` CLI installed.
//
// While both CLIs exist, `mewkit-next` records what it installed in its own
// ownership index (`.meowkit/state/ownership/<runtime>.json` in a project,
// `~/.mewkit/state/ownership/<runtime>.json` for a global install). This CLI
// does not read that index, so its `--force` and re-migrate paths would
// overwrite those files wholesale. Once a runtime belongs to `mewkit-next`,
// it is managed there only.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type GuardedRuntime = "claude-code" | "codex" | "cursor";

/** The `mewkit-next` ownership index for `runtime`, if one exists at this scope. */
export function mewkitNextIndex(projectRoot: string, runtime: GuardedRuntime, global = false): string | undefined {
	const file = global
		? join(homedir(), ".mewkit", "state", "ownership", `${runtime}.json`)
		: join(projectRoot, ".meowkit", "state", "ownership", `${runtime}.json`);
	return isMewkitNextIndex(file) ? file : undefined;
}

/** A readable JSON object carrying the index's own fields. A stray, empty or
 *  corrupt file does not lock this CLI out of a runtime. */
function isMewkitNextIndex(file: string): boolean {
	try {
		const parsed: unknown = JSON.parse(readFileSync(file, "utf-8"));
		return (
			typeof parsed === "object" &&
			parsed !== null &&
			"schema_version" in parsed &&
			"paths" in parsed
		);
	} catch {
		return false;
	}
}

/** The explanation printed when a runtime is refused. */
export function mewkitNextRefusal(command: string, runtime: GuardedRuntime, index: string): string {
	return (
		`mewkit ${command}: ${runtime} here was installed by mewkit-next (${index}).\n` +
		`  Manage it with mewkit-next instead: \`mewkit-next upgrade\`, \`mewkit-next uninstall --target ${runtime}\`.`
	);
}

/** Thrown where a write to a `mewkit-next` runtime would otherwise begin. */
export class MewkitNextOwnedError extends Error {
	constructor(command: string, runtime: GuardedRuntime, index: string) {
		super(mewkitNextRefusal(command, runtime, index));
		this.name = "MewkitNextOwnedError";
	}
}

/** Throw if `runtime` at this scope belongs to `mewkit-next`. */
export function assertNotMewkitNext(command: string, projectRoot: string, runtime: GuardedRuntime, global = false): void {
	const index = mewkitNextIndex(projectRoot, runtime, global);
	if (index !== undefined) throw new MewkitNextOwnedError(command, runtime, index);
}
