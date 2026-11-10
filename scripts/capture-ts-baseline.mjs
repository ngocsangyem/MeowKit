#!/usr/bin/env node
/**
 * Freeze what the npm `mewkit` CLI installs today, per target, as golden manifests.
 *
 * The Rust `mewkit-next` must either reproduce these trees or list each intended
 * difference in `crates/mewkit-cli/tests/golden/DIVERGENCES.md`. A manifest is a
 * reference, not a contract: it records `relative path`, `sha256`, `size` and an
 * `exec` flag (POSIX execute bit) for every file one `init --target <t> --yes`
 * writes, under the project root or the redirected home (`~/…`). Capture and
 * check on macOS or Linux: Windows has no execute bit to record.
 *
 * The run is hermetic: the kit comes from this checkout's git-tracked ship set
 * (via `MEOWKIT_RELEASE_SOURCE`, no download), `HOME` points into a temp dir, the
 * `MEOWKIT_`/`MEOW_`/`MK_` environment is stripped, and the offline preload makes
 * any network call fail. Files whose bytes depend on when or where the
 * install ran are recorded with `"volatile": true` and no digest.
 *
 * Usage:
 *   node scripts/capture-ts-baseline.mjs           write the manifests
 *   node scripts/capture-ts-baseline.mjs --check   compare; exit 1 on any difference
 *
 * Requires a built CLI: `npm run build`.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(REPO, "packages", "mewkit", "dist", "index.js");
const OFFLINE_PRELOAD = join(REPO, "tests", "install", "lib", "offline-refusal.cjs");
const OUT_DIR = join(REPO, "crates", "mewkit-cli", "tests", "golden", "ts-baseline");
const TARGETS = ["claude-code", "codex", "cursor"];
/** Stands in for a release tag, so the recorded install version never tracks the checkout. */
const KIT_VERSION = "0.0.0-baseline";
/**
 * Files whose bytes carry the install's own time, temp paths or the absolute
 * path of the CLI that ran it (`~/.mewkit/cli/<version>.json`). Matched on the
 * manifest path; anything else that differs between two runs is a real change.
 */
const VOLATILE = [
	/^~\/\.mewkit\/cli\//,
	/^\.claude\/runtime\.json$/,
	/^\.meowkit\/metadata\.json$/,
	/^\.meowkit\/state\//,
	/^\.meowkit\/telemetry\//,
	/^\.meowkit\/backups\//,
];

const require = createRequire(import.meta.url);
const { excludeMatcher, shipSetExclusions, shipSetFiles } = require("./kit-ship-set.cjs");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const toPosix = (p) => p.split(sep).join("/");

/** Every file under `dir`, as posix paths relative to it, sorted. */
function walk(dir) {
	const out = [];
	const visit = (abs) => {
		for (const name of readdirSync(abs)) {
			const child = join(abs, name);
			if (statSync(child).isDirectory()) visit(child);
			else out.push(toPosix(relative(dir, child)));
		}
	};
	if (existsSync(dir)) visit(dir);
	return out.sort();
}

/**
 * An extracted-release directory built from the git-tracked archive ship set, so an
 * untracked cache or log in the developer's checkout cannot reach the baseline.
 */
function stageRelease(base) {
	const dir = join(base, "release");
	// The archive's own ship set, narrowed to git-tracked files: a real release
	// carries exactly these, so the baseline cannot record a file it never ships.
	const tracked = new Set(execFileSync("git", ["ls-files", "-z"], { cwd: REPO, encoding: "utf8" }).split("\0"));
	const shipped = shipSetFiles(REPO, excludeMatcher(shipSetExclusions(REPO))).filter((p) => tracked.has(p));
	for (const rel of shipped) {
		const from = join(REPO, rel);
		if (!existsSync(from) || !statSync(from).isFile()) continue;
		mkdirSync(dirname(join(dir, rel)), { recursive: true });
		cpSync(from, join(dir, rel));
	}
	writeFileSync(join(dir, "release-version.txt"), `${KIT_VERSION}\n`);
	// The install reads per-file checksums from this file to decide what the
	// release still ships; an empty list would mark every file an orphan.
	const files = walk(join(dir, ".claude")).map((p) => ({
		path: p,
		checksum: sha256(readFileSync(join(dir, ".claude", p))),
	}));
	writeFileSync(
		join(dir, "release-manifest.json"),
		JSON.stringify({ version: KIT_VERSION, generatedAt: new Date(0).toISOString(), files, deletions: [] }, null, 2),
	);
	return dir;
}

/** The environment with every kit variable stripped and home redirected into `home`. */
function hermeticEnv(home, release) {
	const env = {};
	for (const [k, v] of Object.entries(process.env)) if (!/^(MEOWKIT|MEOW|MK)_/.test(k)) env[k] = v;
	return {
		...env,
		HOME: home,
		USERPROFILE: home,
		MEOWKIT_RELEASE_SOURCE: release,
		NODE_OPTIONS: `${env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ` : ""}--require ${JSON.stringify(OFFLINE_PRELOAD)}`,
		NO_COLOR: "1",
	};
}

function entries(root, prefix) {
	return walk(root)
		.filter((p) => !p.startsWith(".git/"))
		.map((p) => {
			const path = `${prefix}${p}`;
			if (VOLATILE.some((re) => re.test(path))) return { path, volatile: true };
			const buf = readFileSync(join(root, p));
			const exec = (statSync(join(root, p)).mode & 0o111) !== 0;
			return { path, sha256: sha256(buf), size: buf.length, ...(exec ? { exec: true } : {}) };
		});
}

/** Install one target into a fresh project and return its manifest. */
function capture(target, base, release) {
	const home = join(base, target, "home");
	const project = join(base, target, "project");
	mkdirSync(home, { recursive: true });
	mkdirSync(project, { recursive: true });
	execFileSync("git", ["init", "-q"], { cwd: project });
	const run = spawnSync(process.execPath, [CLI, "init", "--target", target, "--yes"], {
		cwd: project,
		env: hermeticEnv(home, release),
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	if (run.status !== 0) {
		throw new Error(`init --target ${target} exited ${run.status}\n${run.stdout}\n${run.stderr}`);
	}
	return {
		target,
		command: `mewkit init --target ${target} --yes`,
		kitVersion: KIT_VERSION,
		files: [...entries(project, ""), ...entries(home, "~/")],
	};
}

function diff(expected, actual) {
	const key = (e) => JSON.stringify(e);
	const exp = new Map(expected.files.map((e) => [e.path, e]));
	const act = new Map(actual.files.map((e) => [e.path, e]));
	const lines = [];
	for (const [p, e] of exp) {
		if (!act.has(p)) lines.push(`- ${p}`);
		else if (key(e) !== key(act.get(p))) lines.push(`~ ${p}`);
	}
	for (const p of act.keys()) if (!exp.has(p)) lines.push(`+ ${p}`);
	return lines;
}

function main() {
	const check = process.argv.includes("--check");
	if (!existsSync(CLI)) throw new Error(`${CLI} not found — run \`npm run build\` first`);
	const base = mkdtempSync(join(tmpdir(), "mewkit-ts-baseline-"));
	let failed = false;
	try {
		const release = stageRelease(base);
		mkdirSync(OUT_DIR, { recursive: true });
		for (const target of TARGETS) {
			const manifest = capture(target, base, release);
			const file = join(OUT_DIR, `${target}.manifest.json`);
			if (!check) {
				writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
				console.log(`${target}: ${manifest.files.length} files → ${toPosix(relative(REPO, file))}`);
				continue;
			}
			if (!existsSync(file)) {
				console.log(`${target}: no committed manifest at ${toPosix(relative(REPO, file))}`);
				failed = true;
				continue;
			}
			const lines = diff(JSON.parse(readFileSync(file, "utf8")), manifest);
			console.log(`${target}: ${lines.length === 0 ? "no difference" : `${lines.length} difference(s)`}`);
			for (const line of lines) console.log(`  ${line}`);
			if (lines.length > 0) failed = true;
		}
	} finally {
		rmSync(base, { recursive: true, force: true });
	}
	if (failed) process.exitCode = 1;
}

main();
