#!/usr/bin/env node
// MANUAL / OPTIONAL model-in-loop Codex canary — the behavioral counterpart to the
// deterministic structural lane (scripts/codex-compat-check.mjs). This drives a REAL,
// authenticated Codex session against a freshly-installed bundle to prove the surfaces
// actually behave at runtime: skill routing, agent spawn, and a hook fire.
//
// It is NEVER wired into CI and NEVER gates structural results (approved separation: a
// model-in-loop failure files an issue, it does not turn the structural lane green or red).
// It requires an authenticated Codex session and human observation, so it prints the
// scenario and exits 0 — it does not assert pass/fail on the model's behavior.
//
// Usage: node scripts/codex-model-canary.mjs   (run by a human, in a trusted project)
import { spawnSync } from "node:child_process";

const SCENARIO = [
	"1. In a temp project, run:  mewkit init --target codex --yes",
	"2. Trust the project .codex layer when Codex prompts (per-hook-hash trust via /hooks).",
	"3. SKILL ROUTING — ask Codex a task that should route to a bundled skill (e.g. \"plan a",
	"   small feature\") and confirm it invokes the expected skill, not an ad-hoc answer.",
	"4. AGENT SPAWN — trigger work that should fork a sub-agent (e.g. a review) and confirm",
	"   the .codex/agents/*.toml agent is selected by name.",
	"5. HOOK FIRE — attempt a gated action (a source edit with no approved plan, or a",
	"   force-push) and confirm the PreToolUse hook / execpolicy prompt fires (deny/prompt).",
	"6. Record the outcome. Any failure → file an issue; do NOT alter the structural lane.",
];

function codexPresent() {
	const r = spawnSync("codex", ["--version"], { encoding: "utf8" });
	return r.status === 0 ? (r.stdout || "").trim() : null;
}

const version = codexPresent();
console.log("Codex model-in-loop canary (MANUAL — not run in CI, never gates structural results)\n");
if (!version) {
	console.log("Codex CLI not found. Install it and run this in a trusted project to perform the canary.\n");
} else {
	console.log(`Detected ${version}. This canary needs an AUTHENTICATED session; run the steps below by hand.\n`);
}
console.log("Scenario:");
for (const line of SCENARIO) console.log(`  ${line}`);
console.log("\n(Exit 0 — observational only.)");
process.exit(0);
