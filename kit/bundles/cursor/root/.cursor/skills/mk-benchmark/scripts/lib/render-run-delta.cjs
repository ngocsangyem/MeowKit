#!/usr/bin/env node
// render-run-delta.cjs — join two benchmark run manifests by task name and emit a
// markdown delta table on stdout.
//
// Input (env, so a run id containing quotes cannot reach the parser as code):
//   FILE_A, FILE_B — paths to two `{run_id, tier, model, tasks[]}` JSON manifests.
//
// Runs on node: no `jq` and no interpreter the project may not have.

const fs = require("node:fs");

function load(label) {
	const file = process.env[label];
	if (!file) {
		process.stderr.write(`ERROR: ${label} not set\n`);
		process.exit(1);
	}
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Two decimals, matching the table's fixed-width columns. */
function f2(n) {
	return Number(n).toFixed(2);
}

function signed(n) {
	return `${n >= 0 ? "+" : ""}${f2(n)}`;
}

function byName(run) {
	return new Map((run.tasks ?? []).map((t) => [t.name, t]));
}

const a = load("FILE_A");
const b = load("FILE_B");
const ta = byName(a);
const tb = byName(b);
const names = [...new Set([...ta.keys(), ...tb.keys()])].sort();

const out = [];
out.push(`# Benchmark Comparison: ${a.run_id} vs ${b.run_id}`, "");
out.push(`**Run A:** ${a.run_id} (${a.tier}, model: ${a.model ?? "?"})`);
out.push(`**Run B:** ${b.run_id} (${b.tier}, model: ${b.model ?? "?"})`);
if ((a.model ?? null) !== (b.model ?? null)) {
	out.push("", "> Model differs between runs — model upgrade is a confounding variable.");
}
out.push("", "| Task | Run A | Run B | Δ score | Δ cost |", "|---|---|---|---|---|");

let totalA = 0;
let totalB = 0;
let scored = 0;

for (const name of names) {
	const taskA = ta.get(name) ?? {};
	const taskB = tb.get(name) ?? {};
	const rawA = taskA.weighted_score ?? null;
	const rawB = taskB.weighted_score ?? null;
	// A null score is PENDING, which is a different thing from a valid 0 and must
	// not be averaged in.
	if (rawA === null || rawB === null) {
		const showA = rawA === null ? "PENDING" : f2(rawA);
		const showB = rawB === null ? "PENDING" : f2(rawB);
		out.push(`| ${name} | ${showA} | ${showB} | — (PENDING — excluded from average) | — |`);
		continue;
	}
	const deltaScore = rawB - rawA;
	const deltaCost = (taskB.cost_usd || 0) - (taskA.cost_usd || 0);
	out.push(`| ${name} | ${f2(rawA)} | ${f2(rawB)} | ${signed(deltaScore)} | ${deltaCost >= 0 ? "+" : ""}$${f2(deltaCost)} |`);
	totalA += rawA;
	totalB += rawB;
	scored += 1;
}

const avgA = scored ? totalA / scored : 0;
const avgB = scored ? totalB / scored : 0;
out.push(`| **AVG** | ${f2(avgA)} | ${f2(avgB)} | ${signed(avgB - avgA)} | — |`, "");
out.push(`**Run A total cost:** $${f2(a.total_cost_usd ?? 0)}`);
out.push(`**Run B total cost:** $${f2(b.total_cost_usd ?? 0)}`);

console.log(out.join("\n"));
