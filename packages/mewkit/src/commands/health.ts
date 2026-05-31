import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import type { Status } from "./doctor-checks.js";
import { checkHardGates } from "./doctor-hard-gates.js";
import { checkMemoryHealth } from "./doctor-memory-checks.js";
import { buildInventory } from "../core/build-inventory.js";
import { checkStaleIndex } from "../core/check-stale-index.js";
import { computeContextBudget } from "../core/context-budget.js";
import { readInstallMetadata } from "../core/install-metadata.js";
import { collectProviderContractDiagnostics } from "../migrate/provider-contract-diagnostics.js";
import { diagnosticToStatus } from "./validate.js";
import { readEvents } from "../core/event-log.js";
import { readGatePolicy } from "../core/gate-policy.js";

/**
 * `mewkit health` — one-command harness control panel. Almost pure composition of
 * producers that already exist (hard gates, inventory, budget, memory, portability)
 * plus event-derived panels on top of the P1 reader. Honest by construction: a hook
 * COUNT (never an undefined-denominator rate), an `N/A` for usage events that have
 * no emitter, and a budget threshold sourced from the CI cap (never a fresh number).
 */

export interface HealthOptions {
	json?: boolean;
	/** Window for event-derived panels: `Nd` / `Nh`. */
	last?: string;
}

interface Panel {
	panel: string;
	status: Status;
	detail: string;
}

interface StatusLike {
	status: Status;
}

/** Roll a producer's results to a single status: fail > warn > pass; all-na → na. */
function rollup(results: StatusLike[]): Status {
	if (results.length === 0) return "na";
	if (results.some((r) => r.status === "fail")) return "fail";
	if (results.some((r) => r.status === "warn")) return "warn";
	if (results.some((r) => r.status === "pass")) return "pass";
	return "na";
}

function findClaudeDir(): string | null {
	const candidate = path.join(process.cwd(), ".claude");
	return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() ? candidate : null;
}

/** The core-profile context cap the CI gate enforces — single source, no fresh number. */
function readCiBudgetCap(repoRoot: string): number | null {
	try {
		const ci = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
		const m = ci.match(/budget context[^\n]*--fail-over\s+(\d+)/);
		return m ? Number(m[1]) : null;
	} catch {
		return null;
	}
}

function gatesPanel(gates: StatusLike[]): Panel {
	const pass = gates.filter((g) => g.status === "pass").length;
	return { panel: "Hard gates", status: rollup(gates), detail: `${pass}/${gates.length} gate probes pass.` };
}

function contextBudgetPanel(claudeDir: string, repoRoot: string, profile: string): Panel {
	const report = computeContextBudget(claudeDir, profile);
	const cap = readCiBudgetCap(repoRoot);
	if (cap === null) {
		return {
			panel: "Context budget",
			status: "na",
			detail: `${report.tokens} tokens (${profile}); CI cap not found in ci.yml — no threshold to grade against.`,
		};
	}
	const status: Status = report.tokens > cap ? "fail" : report.tokens > cap * 0.85 ? "warn" : "pass";
	return { panel: "Context budget", status, detail: `${report.tokens} / ${cap} tokens (${profile} profile, CI cap).` };
}

function portabilityPanel(): Panel {
	const diagnostics = collectProviderContractDiagnostics();
	let nPass = 0;
	let nFail = 0;
	for (const d of diagnostics) {
		const s = diagnosticToStatus(d.surfaceStatus, d.severity);
		if (s === "pass") nPass++;
		else if (s === "fail") nFail++;
	}
	const total = diagnostics.length;
	const coverage = total > 0 ? Math.round((nPass / total) * 100) : 0;
	return {
		panel: "Portability coverage",
		status: nFail > 0 ? "fail" : "pass",
		detail: `${coverage}% native (${nPass}/${total} surfaces); ${nFail} fail.`,
	};
}

function hookFailurePanel(claudeDir: string, since: string | undefined, windowLabel: string): Panel {
	// COUNT, not a rate — the taxonomy emits only hook.failed (no hook.invoked
	// denominator). A rate would be N/0.
	const { events } = readEvents(claudeDir, { since, types: ["hook.failed"] });
	return {
		panel: "Hook failures",
		status: events.length > 0 ? "warn" : "pass",
		detail: `${events.length} hook failure(s) ${windowLabel}.`,
	};
}

function repeatedFailuresPanel(claudeDir: string, since: string | undefined, windowLabel: string): Panel {
	const { events } = readEvents(claudeDir, { since, types: ["gate.blocked", "hook.failed", "verdict_written"] });
	if (events.length === 0) {
		return { panel: "Top repeated failures", status: "na", detail: `No events ${windowLabel}.` };
	}
	const tally = new Map<string, number>();
	for (const e of events) {
		let key: string | null = null;
		if (e.event === "gate.blocked") key = `gate:${String(e.data.gate ?? "?")}`;
		else if (e.event === "hook.failed") key = `hook:${String(e.data.hook ?? "?")}`;
		else if (e.event === "verdict_written" && String(e.data.overall).toUpperCase() === "FAIL")
			key = `review:${String(e.data.slug ?? "?")}`;
		if (key) tally.set(key, (tally.get(key) ?? 0) + 1);
	}
	const repeated = [...tally.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
	if (repeated.length === 0) {
		return { panel: "Top repeated failures", status: "pass", detail: `No repeated failures ${windowLabel}.` };
	}
	const top = repeated
		.slice(0, 3)
		.map(([k, n]) => `${k} ×${n}`)
		.join(", ");
	return { panel: "Top repeated failures", status: "warn", detail: top };
}

function policyPanel(claudeDir: string): Panel {
	const current = readGatePolicy(claudeDir);
	return {
		panel: "Gate policy",
		status: current.error ? "warn" : "pass",
		detail: `${current.policy.profile} (${current.source})${current.error ? ` — ${current.error}` : ""}`,
	};
}

function statusChip(status: Status): string {
	switch (status) {
		case "pass":
			return pc.green("PASS");
		case "warn":
			return pc.yellow("WARN");
		case "fail":
			return pc.red("FAIL");
		default:
			return pc.dim("N/A ");
	}
}

export async function health(opts: HealthOptions = {}): Promise<void> {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error(pc.red("Could not find .claude/ directory in the current directory."));
		process.exit(1);
	}
	const repoRoot = path.dirname(claudeDir);
	const since = opts.last;
	const windowLabel = since ? `(last ${since})` : "(all time)";

	const profile = readInstallMetadata(claudeDir).meta?.profile ?? "core";
	const gates = await checkHardGates(repoRoot);
	const inventory = buildInventory(claudeDir);
	const deprecated = inventory.entries.filter((e) => e.status === "deprecated" || e.status === "experimental");
	const stale = checkStaleIndex(repoRoot);
	const staleFails = stale.filter((r) => r.status === "fail");
	const memory = checkMemoryHealth(repoRoot);

	const panels: Panel[] = [
		gatesPanel(gates),
		hookFailurePanel(claudeDir, since, windowLabel),
		{
			panel: "Stale inventory",
			status: rollup(stale),
			detail: staleFails.length === 0 ? "Docs/index counts match the inventory." : `${staleFails.length} drift issue(s).`,
		},
		{
			panel: "Deprecated artifacts",
			status: deprecated.length > 0 ? "warn" : "pass",
			detail: `${deprecated.length} deprecated/experimental artifact(s) of ${inventory.entries.length}.`,
		},
		contextBudgetPanel(claudeDir, repoRoot, profile),
		{ panel: "Memory health", status: rollup(memory), detail: memory.map((x) => x.detail).join(" ") },
		portabilityPanel(),
		policyPanel(claudeDir),
		repeatedFailuresPanel(claudeDir, since, windowLabel),
		{
			// skill.invoked has no emitter today — computing inventory − invoked-set would
			// mark EVERY skill unused. Render N/A, never a list. Informational, not prune advice.
			panel: "Unused skills/agents",
			status: "na",
			detail: "N/A — usage events not emitted (informational; pruning is out of scope).",
		},
	];

	const counts = { pass: 0, warn: 0, fail: 0, na: 0 };
	for (const p of panels) counts[p.status]++;

	if (opts.json) {
		console.log(JSON.stringify({ profile, window: windowLabel, rollup: counts, panels }, null, 2));
		return;
	}

	console.log(pc.bold(pc.cyan("MeowKit health — harness control panel")));
	console.log(
		`${pc.green(`${counts.pass} PASS`)} / ${pc.yellow(`${counts.warn} WARN`)} / ${pc.red(`${counts.fail} FAIL`)}` +
			(counts.na > 0 ? ` / ${pc.dim(`${counts.na} N/A`)}` : "") +
			pc.dim(`  ·  profile: ${profile}  ·  ${windowLabel}`),
	);
	console.log();
	const width = Math.max(...panels.map((p) => p.panel.length));
	for (const p of panels) {
		console.log(`  [${statusChip(p.status)}] ${p.panel.padEnd(width)}  ${pc.dim(p.detail)}`);
	}
}
