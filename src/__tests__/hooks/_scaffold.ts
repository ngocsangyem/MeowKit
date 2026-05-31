// Temp-project builder for configured-hook integration tests. Thin wrapper over the
// shared production scaffolder so tests and `doctor --hard-gates` use one implementation.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scaffoldHarnessProject, type HarnessProject } from "../../../packages/mewkit/src/core/harness-scaffold.js";

const REPO_ROOT = resolve(process.cwd());

/** Settings.json the hooks are actually configured with (the real install). */
export const SETTINGS = JSON.parse(readFileSync(resolve(REPO_ROOT, ".claude/settings.json"), "utf8")) as Record<
	string,
	unknown
>;

/** Build a throwaway project copying the repo's real .claude harness. */
export function scaffold(): HarnessProject {
	return scaffoldHarnessProject(REPO_ROOT);
}

export type { HarnessProject };
