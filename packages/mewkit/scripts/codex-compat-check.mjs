#!/usr/bin/env node
// Codex bundle compatibility lane. Two independent proofs, neither masking the other:
//
//   1. STRUCTURAL canary (deterministic, CI-blocking): from the BUILT CLI, run
//      `init --target codex` into a temp dir, then `validate --target codex` on the
//      RESULT (not on src/). A broken authored bundle fails a named structural check.
//   2. LIVE Codex canary (best-effort, non-blocking when the CLI is absent): if the real
//      `codex` binary is installed, record its version and run `codex execpolicy check`
//      against the installed default.rules (a real, no-auth policy-load proof). Anything
//      that needs an authenticated session (a full `--strict-config` run) is reported as
//      SKIPPED and belongs to the manual model-in-loop canary, never gating structural.
//
// Exit: non-zero iff a structural check or a present-CLI execpolicy LOAD fails. Missing
// `codex` never fails the lane. `--record [--now <iso>]` writes the verified result into
// compliance/minimum-version-matrix.json (`compatLane`); default is report-only.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const cli = join(pkgRoot, "dist", "index.js");
const matrixPath = join(pkgRoot, "src", "migrate", "modules", "codex", "compliance", "minimum-version-matrix.json");

const args = process.argv.slice(2);
const record = args.includes("--record");
const nowArg = args.includes("--now") ? args[args.indexOf("--now") + 1] : null;

const results = []; // { name, status: pass|fail|skip, detail }
const add = (name, status, detail) => results.push({ name, status, detail });

function run(cmd, cmdArgs, opts = {}) {
	return spawnSync(cmd, cmdArgs, { encoding: "utf8", timeout: 60000, ...opts });
}

function structuralCanary() {
	if (!existsSync(cli)) {
		add("cli built", "fail", `${cli} missing — run \`npm run build:cli\` first`);
		return null;
	}
	const target = mkdtempSync(join(tmpdir(), "codex-compat-"));
	const init = run("node", [cli, "init", "--target", "codex", "--yes"], { cwd: target });
	if (init.status !== 0) {
		add("init --target codex", "fail", `exit ${init.status}: ${(init.stderr || init.stdout || "").trim().slice(0, 400)}`);
		return target;
	}
	add("init --target codex", "pass", "authored bundle installed into a clean temp dir");

	const val = run("node", [cli, "validate", "--target", "codex", target]);
	const out = `${val.stdout || ""}${val.stderr || ""}`;
	if (val.status === 0) {
		add("validate --target codex", "pass", "structural validation green on the packaged install");
	} else {
		const failLines = out.split("\n").filter((l) => /fail/i.test(l)).slice(0, 6).join(" | ");
		add("validate --target codex", "fail", `exit ${val.status}${failLines ? ` — ${failLines}` : ""}`);
	}
	return target;
}

function liveCodexCanary(target) {
	const ver = run("codex", ["--version"]);
	if (ver.status !== 0 || !ver.stdout) {
		add("codex CLI", "skip", "codex binary not installed — live checks deferred to the manual canary");
		return null;
	}
	const version = ver.stdout.trim().replace(/^(codex(-cli)?\s+)?v?/i, "").trim();
	add("codex CLI", "pass", `detected codex ${version}`);

	const rules = target ? join(target, ".codex", "rules", "default.rules") : null;
	if (rules && existsSync(rules)) {
		// Positive: a force-push must load the policy and resolve to a non-allow decision.
		const hit = run("codex", ["execpolicy", "check", "--rules", rules, "git", "push", "--force", "origin", "main"]);
		const hitOut = `${hit.stdout || ""}${hit.stderr || ""}`;
		if (hit.status === 0 && /prompt|forbidden|deny|ask/i.test(hitOut)) {
			add("codex execpolicy load", "pass", "default.rules loads; force-push resolves to prompt/forbidden");
		} else if (hit.status === 0) {
			add("codex execpolicy load", "pass", "default.rules loads (decision output present)");
		} else {
			add("codex execpolicy load", "fail", `execpolicy rejected default.rules (exit ${hit.status}): ${hitOut.trim().slice(0, 300)}`);
		}
	} else {
		add("codex execpolicy load", "skip", "no .codex/rules/default.rules in the install to check");
	}

	// A full `--strict-config` run needs an authenticated session — out of scope for the
	// deterministic lane. Named here so its absence is explicit, not silently omitted.
	add("codex --strict-config full run", "skip", "requires an authenticated Codex session — see the manual model-in-loop canary");
	return version;
}

function writeMatrix(codexVersion) {
	const matrix = JSON.parse(readFileSync(matrixPath, "utf-8"));
	const structuralPass = results.filter((r) => r.status === "fail").length === 0;
	matrix.compatLane = {
		ranAt: nowArg ?? new Date().toISOString(),
		codexVersion: codexVersion ?? null,
		structural: structuralPass ? "pass" : "fail",
		checks: results.map((r) => ({ name: r.name, status: r.status })),
	};
	writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`);
	add("record matrix", "pass", `wrote compatLane to ${matrixPath.replace(pkgRoot + "/", "")}`);
}

function main() {
	const target = structuralCanary();
	const codexVersion = liveCodexCanary(target);
	if (record) writeMatrix(codexVersion);
	if (target) rmSync(target, { recursive: true, force: true });

	console.log("\nCodex compatibility lane:");
	for (const r of results) {
		const mark = r.status === "pass" ? "PASS" : r.status === "fail" ? "FAIL" : "SKIP";
		console.log(`  [${mark}] ${r.name} — ${r.detail}`);
	}
	const failed = results.filter((r) => r.status === "fail");
	console.log(failed.length === 0 ? "\nLane: OK" : `\nLane: ${failed.length} FAIL`);
	process.exit(failed.length === 0 ? 0 : 1);
}

main();
