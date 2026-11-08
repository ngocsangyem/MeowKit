// Run the real install commands against a throwaway project, with no network.
//
// Everything about ownership — what the kit laid down, what the user changed,
// what may therefore be deleted — is decided by `init` and `upgrade`. Until this
// harness existed those two were the only commands no test could execute, because
// each reaches a GitHub release. The release lookup now accepts a local directory,
// so this builds one out of the repository's own kit tree and drives the published
// CLI binary against a scratch project exactly as a user would.
//
// Two properties are deliberate. The scratch project gets its own `HOME`, so a
// user-scope config in the developer's real home cannot reach the fixture. And the
// whole `MEOWKIT_`/`MEOW_`/`MK_` block is stripped from the inherited environment,
// so a name exported in the invoking shell cannot decide a test's outcome.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..");
export const CLI = join(REPO_ROOT, "packages", "mewkit", "dist", "index.js");
/** Preloaded into every spawned command so the run cannot reach the network. */
export const OFFLINE_PRELOAD = join(HERE, "lib", "offline-refusal.cjs");

/** The `.meowkit/` members the kit itself ships, as opposed to a project's own state. */
export const KIT_MEOWKIT_FILES = [
	".gitignore",
	".env.example",
	"gitignore.meowkit",
	"mcp.json.example",
	"pack-manifest.json",
];

const cachedAssets = new Map<string, string>();

/** Every file under the asset's `.claude/`, hashed, keyed the way the kit keys them. */
function manifestFiles(assetDir: string): { path: string; checksum: string }[] {
	const out: { path: string; checksum: string }[] = [];
	const walk = (dir: string, prefix: string): void => {
		for (const name of readdirSync(dir)) {
			const abs = join(dir, name);
			if (statSync(abs).isDirectory()) walk(abs, `${prefix}${name}/`);
			else out.push({ path: `${prefix}${name}`, checksum: createHash("sha256").update(readFileSync(abs)).digest("hex") });
		}
	};
	walk(join(assetDir, ".claude"), "");
	return out;
}

/**
 * A directory in the shape of an extracted release, built from this repository's
 * own kit tree. Built once per process: it is read-only to every caller, and
 * copying 1200-odd files per test would dominate the suite's runtime.
 */
export function releaseAsset(version = "9.9.9-fixture"): string {
	const already = cachedAssets.get(version);
	if (already !== undefined) return already;
	const dir = mkdtempSync(join(tmpdir(), "meowkit-asset-"));
	cpSync(join(REPO_ROOT, ".claude"), join(dir, ".claude"), {
		recursive: true,
		dereference: true,
		// A sibling session checkout and a log directory are not kit content.
		filter: (src) => !src.includes(`${join(".claude", "worktrees")}`) && !src.includes(`${join(".claude", "logs")}`),
	});
	mkdirSync(join(dir, ".meowkit"), { recursive: true });
	for (const name of KIT_MEOWKIT_FILES) {
		const from = join(REPO_ROOT, ".meowkit", name);
		if (existsSync(from)) cpSync(from, join(dir, ".meowkit", name));
	}
	writeFileSync(join(dir, "release-version.txt"), `${version}\n`, "utf8");
	// A real release asset carries this file, and the install reads two things
	// from it: the version it records into `.meowkit/metadata.json`, and the
	// per-file checksums that decide which installed files the release still
	// ships. An EMPTY `files[]` is not a shortcut — it makes every installed file
	// look like an orphan the release dropped — so it is generated from the
	// asset's own tree, the way the release pipeline generates it.
	writeFileSync(
		join(dir, "release-manifest.json"),
		JSON.stringify(
			{
				version,
				generatedAt: new Date(0).toISOString(),
				files: manifestFiles(dir),
				deletions: [],
			},
			null,
			2,
		),
		"utf8",
	);
	cachedAssets.set(version, dir);
	return dir;
}

export interface Fixture {
	/** The scratch project root — the `cwd` every command runs in. */
	root: string;
	/** The scratch home, so `~/.meowkit/config.yaml` is the fixture's own. */
	home: string;
	asset: string;
	version: string;
}

/** A base environment with every kit name stripped and nothing pointing at the repo. */
function baseEnv(fx: Fixture, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (/^(MEOWKIT|MEOW|MK)_/.test(key)) continue;
		if (value !== undefined) env[key] = value;
	}
	env.HOME = fx.home;
	env.USERPROFILE = fx.home;
	env.MEOWKIT_RELEASE_SOURCE = fx.asset;
	// No subcommand may reach the network. Enforced in-process and inherited by
	// every Node child, because the proxy variables a previous version of this
	// harness set are ignored by `fetch` — so the guarantee is a refusal the
	// runtime cannot route around, not a closed port it may decline to use.
	env.NODE_OPTIONS = `${env.NODE_OPTIONS === undefined ? "" : `${env.NODE_OPTIONS} `}--require ${JSON.stringify(OFFLINE_PRELOAD)}`;
	return { ...env, ...extra };
}

/** A git-initialized scratch project with its own HOME, and no install yet. */
export function createProject(version = "9.9.9-fixture"): Fixture {
	const base = mkdtempSync(join(tmpdir(), "meowkit-fx-"));
	const root = join(base, "project");
	const home = join(base, "home");
	mkdirSync(root, { recursive: true });
	mkdirSync(home, { recursive: true });
	execFileSync("git", ["init", "-q"], { cwd: root });
	execFileSync("git", ["config", "user.email", "fixture@example.invalid"], { cwd: root });
	execFileSync("git", ["config", "user.name", "Fixture"], { cwd: root });
	return { root, home, asset: releaseAsset(version), version };
}

export interface RunResult {
	status: number;
	stdout: string;
	stderr: string;
	all: string;
}

/** Run the published CLI in the fixture. Never throws on a non-zero exit. */
export function runMewkit(fx: Fixture, args: string[], extraEnv: Record<string, string> = {}, asVersion?: string): RunResult {
	const env = baseEnv(fx, extraEnv);
	if (asVersion !== undefined) env.MEOWKIT_RELEASE_SOURCE = releaseAsset(asVersion);
	const r = spawnSync(process.execPath, [CLI, ...args], {
		cwd: fx.root,
		env,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	const stdout = r.stdout ?? "";
	const stderr = r.stderr ?? "";
	return { status: r.status ?? -1, stdout, stderr, all: stdout + stderr };
}

/**
 * Run bare `node` in the fixture's environment. Only the offline guarantee needs
 * it: the mechanism has to be exercised by the same environment the commands get,
 * rather than asserted in a comment above the variable that sets it.
 */
export function runNode(fx: Fixture, args: string[]): RunResult {
	const r = spawnSync(process.execPath, args, { cwd: fx.root, env: baseEnv(fx), encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
	const stdout = r.stdout ?? "";
	const stderr = r.stderr ?? "";
	return { status: r.status ?? -1, stdout, stderr, all: stdout + stderr };
}

/** `mewkit init --yes` — the whole install, non-interactive and offline. */
export function installFixture(version = "9.9.9-fixture"): { fx: Fixture; run: RunResult } {
	const fx = createProject(version);
	return { fx, run: runMewkit(fx, ["init", "--yes"]) };
}

/** Paths git tracks under one directory of the fixture, after staging everything. */
export function trackedUnder(fx: Fixture, dir: string): string[] {
	execFileSync("git", ["add", "-A"], { cwd: fx.root });
	const out = execFileSync("git", ["ls-files", dir], { cwd: fx.root, encoding: "utf8" });
	return out.split("\n").map((s) => s.trim()).filter((s) => s !== "").sort();
}
