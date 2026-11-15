import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Build a throwaway project that mirrors a real MeowKit install closely enough to
 * run its configured hooks: the entire `.claude/hooks/` tree (including `lib/`, so
 * relative `source` paths resolve under CLAUDE_PROJECT_DIR) plus `.claude/settings.json`.
 *
 * Shared by the configured-hook integration tests so there is exactly one
 * "mkdtemp + copy .claude" implementation. Tests mutate `.env` state inside the
 * temp dir, never the source repo.
 */

export interface HarnessProject {
	/** Absolute path to the temp project root (use as CLAUDE_PROJECT_DIR). */
	dir: string;
	/** Remove the temp project. Safe to call multiple times. */
	cleanup: () => void;
	/** Create a sensitive file (default `.env`) in the project root. Returns its path. */
	addEnvFile: (name?: string) => string;
}

function copyClaudeHarness(srcRoot: string, destRoot: string): void {
	const claudeSrc = path.join(srcRoot, ".claude");
	const claudeDst = path.join(destRoot, ".claude");
	fs.mkdirSync(claudeDst, { recursive: true });
	// Whole hooks tree (incl. lib/) so each hook's relative `source` resolves.
	fs.cpSync(path.join(claudeSrc, "hooks"), path.join(claudeDst, "hooks"), { recursive: true });
	fs.copyFileSync(path.join(claudeSrc, "settings.json"), path.join(claudeDst, "settings.json"));
}

/** True if `<srcRoot>/.claude/settings.json` and the hooks tree exist. */
export function hasHarness(srcRoot: string): boolean {
	return (
		fs.existsSync(path.join(srcRoot, ".claude", "settings.json")) &&
		fs.existsSync(path.join(srcRoot, ".claude", "hooks"))
	);
}

export function scaffoldHarnessProject(srcRoot: string): HarnessProject {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mewkit-harness-"));
	copyClaudeHarness(srcRoot, dir);
	fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# test project\n");

	return {
		dir,
		cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
		addEnvFile: (name = ".env") => {
			const envPath = path.join(dir, name);
			fs.writeFileSync(envPath, "SECRET=do-not-read\n");
			return envPath;
		},
	};
}
