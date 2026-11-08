#!/usr/bin/env node
/**
 * check-no-python.cjs — prove the kit's core runtime needs no Python.
 *
 * Builds a PATH with no `python3`, `python` or `py` on it, then runs the hook
 * suites, the injection-audit safety path, every core verb, the plan structural
 * check and `mewkit setup` against it. Exits 0 only if all of them hold, and
 * names the FIRST failure otherwise.
 *
 * Usage:
 *   node scripts/check-no-python.cjs [--allow-existing-envs]
 *
 * `--allow-existing-envs` tolerates a populated `.meowkit/envs/` in the
 * checkout. A clean checkout has none (it is generated and ignored), so the
 * default is the strict precondition; the flag exists for a working tree where
 * a developer has already provisioned one, and prints exactly what it tolerated.
 *
 * Exit: 0 all checks pass; 1 a check failed; 2 a precondition failed.
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { buildNoPythonBin, leakedInterpreters } = require("./lib/no-python-path.cjs");
const { buildFixture, planRel } = require("./lib/no-python-fixture.cjs");
const { buildChecks } = require("./lib/no-python-checks.cjs");

const REPO_ROOT = path.resolve(__dirname, "..");
const CLI = path.join(REPO_ROOT, "packages", "mewkit", "dist", "index.js");
const ALLOW_EXISTING_ENVS = process.argv.includes("--allow-existing-envs");

/** Text that would mean a check only passed because an interpreter was present. */
const INTERPRETER_COMPLAINT = /(python3?: (command )?not found|No Python interpreter|skills\/\.venv)/;

function fail(code, message) {
	process.stderr.write(`${message}\n`);
	process.exit(code);
}

function checkPreconditions() {
	if (!fs.existsSync(CLI)) fail(2, `precondition: CLI not built at ${CLI} — run \`npm run build\``);

	const sharedVenv = path.join(REPO_ROOT, ".claude", "skills", ".venv");
	if (fs.existsSync(sharedVenv)) fail(2, `precondition: a shared venv exists at ${sharedVenv}`);

	const envs = path.join(REPO_ROOT, ".meowkit", "envs");
	const present = fs.existsSync(envs) ? fs.readdirSync(envs) : [];
	if (present.length > 0) {
		const listed = present.join(", ");
		if (!ALLOW_EXISTING_ENVS) {
			fail(2, `precondition: .meowkit/envs/ is not empty (${listed}) — pass --allow-existing-envs to proceed`);
		}
		console.log(`  ! tolerating populated .meowkit/envs/: ${listed} (--allow-existing-envs)`);
	}
}

function makeRunner(binDir) {
	const env = {
		PATH: binDir,
		HOME: process.env.HOME ?? "",
		TMPDIR: process.env.TMPDIR ?? "",
		CI: "1",
		// Node is invoked by absolute path, so npm/npx still need their own cache.
		npm_config_cache: process.env.npm_config_cache ?? "",
	};

	const run = (command, argv, options = {}) => {
		const result = spawnSync(command, argv, {
			cwd: options.cwd ?? REPO_ROOT,
			env,
			input: options.input,
			encoding: "utf-8",
			maxBuffer: 64 * 1024 * 1024,
		});
		const stdout = result.stdout ?? "";
		const stderr = result.stderr ?? "";
		const complaint = INTERPRETER_COMPLAINT.exec(`${stdout}\n${stderr}`);
		return {
			status: result.status === null ? 1 : result.status,
			stdout,
			stderr,
			pythonMentioned: complaint ? complaint[0] : null,
			firstErrorLine: (stderr.split("\n").find(Boolean) ?? stdout.split("\n").find(Boolean) ?? "").slice(0, 160),
			usage: /^Usage:|requires --|Unknown .* subcommand/m.test(`${stdout}\n${stderr}`),
		};
	};

	return { env, run, runCli: (argv, options) => run(process.execPath, [CLI, ...argv], options) };
}

function main() {
	console.log("No-Python runtime check");
	checkPreconditions();

	const binDir = buildNoPythonBin();
	const leaked = leakedInterpreters(binDir);
	if (leaked.length > 0) fail(2, `precondition: sandbox PATH still exposes ${leaked.join(", ")}`);
	console.log(`  PATH sandbox: ${binDir} (python3, python, py absent)`);

	const { env, run, runCli } = makeRunner(binDir);
	const probe = run("/bin/sh", ["-c", "command -v python3 || command -v python || command -v py || echo ABSENT"]);
	if (!probe.stdout.includes("ABSENT")) fail(2, `precondition: an interpreter resolved on the sandbox PATH:\n${probe.stdout}`);

	const fixtureRoot = buildFixture(env, REPO_ROOT);
	console.log(`  fixture project: ${fixtureRoot}`);
	console.log();

	const ctx = { repoRoot: REPO_ROOT, fixtureRoot, planRel, run, runCli };
	const checks = buildChecks(ctx);

	let passed = 0;
	for (const check of checks) {
		let problem;
		try {
			problem = check.run();
		} catch (error) {
			problem = error instanceof Error ? error.message : String(error);
		}
		if (problem) {
			console.log(`  FAIL  ${check.name}`);
			console.log(`        ${problem}`);
			console.log();
			console.log(`${passed} check(s) passed before the first failure; ${checks.length} total.`);
			process.exit(1);
		}
		passed += 1;
		console.log(`  ok    ${check.name}`);
	}

	console.log();
	console.log(`All ${passed} checks passed with no Python interpreter on PATH.`);
}

main();
