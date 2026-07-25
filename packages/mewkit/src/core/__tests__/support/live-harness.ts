import { existsSync } from "node:fs";
import { join } from "node:path";

// Shared cwd guard for the "live harness" contract tests. Several suites read the
// MeowKit source bundle (`.claude/`) from the current working directory. That bundle
// exists at the repo root — the canonical run cwd for `npm test` / CI — and is absent
// in any package subdirectory. Run from a subdir, the reads fail with a cryptic ENOENT
// or an empty-capability assertion that reads like a real product defect when it is only
// a wrong cwd. These helpers turn that into one actionable message.

/** Repo root the live-harness suites expect as cwd (`npm test` / CI run here). */
export const REPO_ROOT = process.cwd();

/** Absolute path to the MeowKit source bundle the live-harness suites read. */
export const LIVE_HARNESS = join(REPO_ROOT, ".claude");

// `pack-manifest.json` is the harness marker: present at the repo-root bundle, never in
// an empty package-subdir `.claude/`.
function assertHarnessPresent(): void {
	if (existsSync(join(LIVE_HARNESS, "pack-manifest.json"))) return;
	throw new Error(
		`Live-harness tests need the MeowKit bundle at "${LIVE_HARNESS}", but it is absent. ` +
			"Run the suite from the meowkit repo root (`npm test`), not a package subdirectory.",
	);
}

/** The `.claude/` bundle path, guarded. Use where a test reads inside `.claude/`. */
export function requireLiveHarness(): string {
	assertHarnessPresent();
	return LIVE_HARNESS;
}

/** The repo root, guarded. Use where a test passes a project root that CONTAINS `.claude/`. */
export function requireLiveHarnessRoot(): string {
	assertHarnessPresent();
	return REPO_ROOT;
}
