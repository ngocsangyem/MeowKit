import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Build a throwaway project that mirrors a real MeowKit install closely enough to
 * run its configured hooks: the entire `.claude/hooks/` tree (including `lib/`, so
 * relative `source` paths resolve under CLAUDE_PROJECT_DIR) plus `.claude/settings.json`.
 *
 * Shared by the configured-hook integration tests and `doctor --hard-gates` so there
 * is exactly one "mkdtemp + copy .claude" implementation. Tests/probes mutate plan and
 * `.env` state inside the temp dir, never the source repo.
 */

export interface HarnessProject {
	/** Absolute path to the temp project root (use as CLAUDE_PROJECT_DIR). */
	dir: string;
	/** Remove the temp project. Safe to call multiple times. */
	cleanup: () => void;
	/** Create a plan file so Gate 1 passes. Returns the plan path. */
	addPlan: (opts?: { nested?: boolean; approved?: boolean; slug?: string }) => string;
	/** Remove all plan files (return Gate 1 to the no-plan state). */
	clearPlans: () => void;
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
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mewkit-hardgate-"));
	copyClaudeHarness(srcRoot, dir);

	const plansDir = path.join(dir, "tasks", "plans");
	fs.mkdirSync(plansDir, { recursive: true });
	fs.mkdirSync(path.join(dir, "tasks", "contracts"), { recursive: true });
	fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# test project\n");

	const frontmatter = (approved: boolean): string =>
		`---\nstatus: ${approved ? "approved" : "pending"}\n---\n# plan\n`;

	return {
		dir,
		cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
		addPlan: (opts = {}) => {
			const slug = opts.slug ?? "260531-demo";
			let planPath: string;
			if (opts.nested) {
				const planDir = path.join(plansDir, slug);
				fs.mkdirSync(planDir, { recursive: true });
				planPath = path.join(planDir, "plan.md");
			} else {
				planPath = path.join(plansDir, `${slug}.md`);
			}
			fs.writeFileSync(planPath, frontmatter(opts.approved ?? false));
			return planPath;
		},
		clearPlans: () => {
			fs.rmSync(plansDir, { recursive: true, force: true });
			fs.mkdirSync(plansDir, { recursive: true });
		},
		addEnvFile: (name = ".env") => {
			const envPath = path.join(dir, name);
			fs.writeFileSync(envPath, "SECRET=do-not-read\n");
			return envPath;
		},
	};
}
