// Integration test for the SessionStart orientation hook (.claude/hooks/handlers/
// orientation-ritual.cjs). It scaffolds a temp project with the checkpoint-utils lib and exercises
// the decision logic against the REAL hook: startup stays disabled; a trusted in-project runtime
// executable is invoked for bounded orientation; a missing/corrupt/out-of-project descriptor falls
// back to a LABELED checkpoint summary. A fake executable (a tiny node script) stands in for the
// installed CLI so the hook's invocation path is exercised without a full install — the real-CLI /
// real-install path is the (externally gated) acceptance demo.
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, copyFileSync, chmodSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
// Resolve the repo `.claude` relative to THIS test file (cwd-independent) — the suite's canonical
// run is from the repo root, so a process.cwd()-relative path would break there.
const REPO_CLAUDE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", ".claude");
const HOOK = join(REPO_CLAUDE, "hooks", "handlers", "orientation-ritual.cjs");
const CHECKPOINT_UTILS = join(REPO_CLAUDE, "hooks", "lib", "checkpoint-utils.cjs");

const roots: string[] = [];
let savedEnv: string | undefined;
beforeEach(() => {
	savedEnv = process.env.CLAUDE_PROJECT_DIR;
});
afterEach(() => {
	if (savedEnv === undefined) delete process.env.CLAUDE_PROJECT_DIR;
	else process.env.CLAUDE_PROJECT_DIR = savedEnv;
	roots.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
	delete require.cache[require.resolve(HOOK)];
	delete require.cache[require.resolve(CHECKPOINT_UTILS)];
});

/** A temp project with the checkpoint-utils lib copied in (the hook requires it at load). */
function scaffold(): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-orient-hook-"));
	roots.push(root);
	const libDir = join(root, ".claude", "hooks", "lib");
	mkdirSync(libDir, { recursive: true });
	copyFileSync(CHECKPOINT_UTILS, join(libDir, "checkpoint-utils.cjs"));
	return root;
}

/** Load the hook fresh with CLAUDE_PROJECT_DIR bound to `root` (env read at module load). */
function loadHook(root: string): (ctx: { source?: string }) => string {
	process.env.CLAUDE_PROJECT_DIR = root;
	delete require.cache[require.resolve(HOOK)];
	delete require.cache[require.resolve(CHECKPOINT_UTILS)];
	return require(HOOK) as (ctx: { source?: string }) => string;
}

/** Install a fake in-project mewkit executable that prints a fixed bounded orientation block. */
function installFakeRuntime(root: string, output: string): string {
	const binDir = join(root, "node_modules", ".bin");
	mkdirSync(binDir, { recursive: true });
	const exe = join(binDir, "mewkit");
	writeFileSync(exe, `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(output)});\n`);
	chmodSync(exe, 0o755);
	writeFileSync(
		join(root, ".claude", "runtime.json"),
		JSON.stringify({ schemaVersion: "1.0", executable: exe, packageVersion: "test", writtenAt: "t" }),
	);
	return exe;
}

function writeCheckpoint(root: string): void {
	const dir = join(root, "session-state", "checkpoints");
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, "checkpoint-latest.json"),
		JSON.stringify({ sequence: 3, progress: { plan_path: "plans/260711-x/plan.md" }, environment: {} }),
	);
}

describe("orientation-ritual hook", () => {
	it("returns nothing on fresh startup (startup stays disabled)", () => {
		const root = scaffold();
		expect(loadHook(root)({ source: "startup" })).toBe("");
	});

	it("invokes the trusted in-project runtime for bounded orientation on resume", () => {
		const root = scaffold();
		installFakeRuntime(root, "[durable task state — untrusted]\norientation: active\ntask: feat-x\n");
		const out = loadHook(root)({ source: "resume" });
		expect(out).toContain("orientation: active");
		expect(out).toContain("task: feat-x");
		expect(out).not.toContain("fallback"); // the runtime path was used, not the checkpoint
	});

	it("falls back to a LABELED checkpoint summary when no runtime descriptor exists", () => {
		const root = scaffold();
		writeCheckpoint(root);
		const out = loadHook(root)({ source: "resume" });
		expect(out).toContain("orientation fallback: installed runtime unavailable");
		expect(out).toContain("checkpoint #3");
	});

	it("falls back when the descriptor points outside the project (tampered) — never runs it", () => {
		const root = scaffold();
		writeCheckpoint(root);
		writeFileSync(
			join(root, ".claude", "runtime.json"),
			JSON.stringify({ schemaVersion: "1.0", executable: "/tmp/evil", packageVersion: "x", writtenAt: "t" }),
		);
		const out = loadHook(root)({ source: "resume" });
		expect(out).toContain("orientation fallback");
	});

	it("falls back on a corrupt descriptor", () => {
		const root = scaffold();
		writeCheckpoint(root);
		writeFileSync(join(root, ".claude", "runtime.json"), "{ not json");
		expect(loadHook(root)({ source: "resume" })).toContain("orientation fallback");
	});

	it("falls back when the in-project executable is a symlink escaping the project", () => {
		const root = scaffold();
		writeCheckpoint(root);
		const outside = mkdtempSync(join(tmpdir(), "mewkit-orient-outside-"));
		roots.push(outside);
		const evil = join(outside, "evil");
		writeFileSync(evil, "#!/usr/bin/env node\nprocess.stdout.write('PWNED');\n");
		chmodSync(evil, 0o755);
		const binDir = join(root, "node_modules", ".bin");
		mkdirSync(binDir, { recursive: true });
		const link = join(binDir, "mewkit");
		symlinkSync(evil, link); // in-project path, out-of-project real target
		writeFileSync(
			join(root, ".claude", "runtime.json"),
			JSON.stringify({ schemaVersion: "1.0", executable: link, packageVersion: "x", writtenAt: "t" }),
		);
		const out = loadHook(root)({ source: "resume" });
		expect(out).not.toContain("PWNED"); // the escaping symlink was never executed
		expect(out).toContain("orientation fallback");
	});

	it("falls back when the descriptor schemaVersion is not 1.0 (mirrors the TS gate)", () => {
		const root = scaffold();
		writeCheckpoint(root);
		installFakeRuntime(root, "orientation: active\n");
		writeFileSync(
			join(root, ".claude", "runtime.json"),
			JSON.stringify({
				schemaVersion: "2.0",
				executable: join(root, "node_modules", ".bin", "mewkit"),
				writtenAt: "t",
			}),
		);
		expect(loadHook(root)({ source: "resume" })).toContain("orientation fallback");
	});
});
