import { execFileSync } from "node:child_process";
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
	/** Create a plan file so Gate 1's presence check passes. Returns the plan path.
	 * NOTE: a plan alone no longer opens Gate 1 — it also needs an approval receipt
	 * (see `approvePlan`). */
	addPlan: (opts?: { nested?: boolean; approved?: boolean; slug?: string }) => string;
	/** Initialise a git repo with a staged source file, so a ship command has a real change set. */
	stageShipCommit: () => boolean;
	/** Write a signed sprint contract for a plan slug, so the contract step is satisfied. */
	addSignedContract: (slug?: string) => string;
	/** Stamp the Gate 1 approval receipt on a plan via the copied approval-receipt.cjs
	 * helper (the same code path the live hook verifies). Returns true on success. */
	approvePlan: (planPath: string) => boolean;
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

/** A fixed identity so the probe repo can commit on a host with no git config. */
const GIT_ENV = {
	...process.env,
	GIT_CONFIG_GLOBAL: "/dev/null",
	GIT_CONFIG_SYSTEM: "/dev/null",
	GIT_AUTHOR_NAME: "mewkit doctor",
	GIT_AUTHOR_EMAIL: "doctor@example.invalid",
	GIT_COMMITTER_NAME: "mewkit doctor",
	GIT_COMMITTER_EMAIL: "doctor@example.invalid",
};

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

	const frontmatter = (approved: boolean): string => `---\nstatus: ${approved ? "approved" : "pending"}\n---\n# plan\n`;

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
		approvePlan: (planPath: string): boolean => {
			const helper = path.join(dir, ".claude", "hooks", "lib", "approval-receipt.cjs");
			if (!fs.existsSync(helper)) return false;
			// The receipt helper is a library, not a CLI, so it is loaded in a child
			// node process rather than executed. Using the copied one is the point:
			// the stamp and the gate's verify then come from the same code.
			const stamp = `require(${JSON.stringify(helper)}).stamp(${JSON.stringify(planPath)}, "doctor")`;
			try {
				execFileSync(process.execPath, ["-e", stamp], { stdio: "pipe" });
				return true;
			} catch {
				return false;
			}
		},
		stageShipCommit: (): boolean => {
			// The ship guard classifies what a command would ship by reading git, so a
			// probe without history and without a staged file is correctly answered
			// with "nothing resolvable" rather than a block. Give it a real ship.
			const git = (args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe", env: GIT_ENV });
			try {
				git(["init", "-q"]);
				fs.writeFileSync(path.join(dir, "README.md"), "# probe\n");
				git(["add", "README.md"]);
				git(["commit", "-q", "-m", "base"]);
				fs.mkdirSync(path.join(dir, "src"), { recursive: true });
				fs.writeFileSync(path.join(dir, "src", "app.ts"), "export const a = 1;\n");
				git(["add", "src/app.ts"]);
				return true;
			} catch {
				return false;
			}
		},
		addSignedContract: (slug = "demo"): string => {
			const contractPath = path.join(dir, "tasks", "contracts", `260531-${slug}-sprint-1.md`);
			fs.writeFileSync(contractPath, "---\nstatus: signed\n---\n\n# contract\n");
			return contractPath;
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
