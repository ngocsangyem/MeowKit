import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// `mewkit review cleanup --session <id>` — remove the ephemeral review worktree by
// delegating to Phase 2's manifest-owned worktree cleanup (which enforces the nonce +
// detached + `.worktrees/review-pr-` guard). The session dir (verdict/proof/evidence)
// is DELIBERATELY kept — it is the audit trail Gate 2 reads. This command never
// removes anything outside the session-owned worktree.

type Exec = (file: string, args: string[], cwd?: string) => { ok: boolean; out: string; err: string };
const realExec: Exec = (file, args, cwd) => {
	try {
		return {
			ok: true,
			out: execFileSync(file, args, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).toString(),
			err: "",
		};
	} catch (e) {
		const x = e as { stdout?: Buffer; stderr?: Buffer; message?: string };
		return { ok: false, out: x.stdout?.toString() ?? "", err: x.stderr?.toString() ?? x.message ?? "exec failed" };
	}
};

export interface CleanupOptions {
	session: string;
	cwd?: string;
	json?: boolean;
	deps?: { exec?: Exec; worktreeScript?: string };
}

export interface CleanupResult {
	ok: boolean;
	error?: string;
	removedWorktree?: boolean;
}

export async function reviewCleanup(options: CleanupOptions): Promise<CleanupResult> {
	const cwd = options.cwd ?? process.cwd();
	const exec = options.deps?.exec ?? realExec;
	const sessionDir = path.join(cwd, "tasks", "reviews", options.session);
	const manifestPath = path.join(sessionDir, "manifest.json");
	const emit = (r: CleanupResult): CleanupResult => {
		if (options.json) console.log(JSON.stringify(r, null, 2));
		else if (r.error) console.error(`✗ ${r.error}`);
		else console.log("✓ review worktree cleaned (session artifacts kept for the audit trail)");
		if (!r.ok) process.exitCode = 1;
		return r;
	};

	if (!fs.existsSync(manifestPath))
		return emit({ ok: false, error: `no review session at ${path.relative(cwd, sessionDir)}` });

	const worktreeScript =
		options.deps?.worktreeScript ?? path.join(cwd, ".claude", "skills", "worktree", "scripts", "worktree.cjs");
	const rel = path.relative(cwd, manifestPath);
	const res = exec("node", [worktreeScript, "review-pr-cleanup", "--manifest", rel, "--json"], cwd);
	if (!res.ok) return emit({ ok: false, error: `worktree cleanup refused/failed: ${res.err || res.out}` });
	return emit({ ok: true, removedWorktree: true });
}
