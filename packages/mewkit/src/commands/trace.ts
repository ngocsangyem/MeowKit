import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
	parseTraceLog,
	scoreByRun,
	scoreTier,
	auditTraces,
	proposeImprovements,
	type TraceRecord,
} from "../core/trace-analysis.js";
import { appendTraceRecordSync } from "../core/trace-append.js";

// On-demand trace recall: score trace quality, audit entropy/drift, propose advisory
// improvements, and record friction — all over the existing append log, with NO inner-harness
// hook required. Every path exits 0 (advisory, never a gate). The `##friction:` hook prefix is
// an optional Claude-Code enhancement; THIS CLI is the portable write contract.

interface TraceOptions {
	subcommand?: string; // score | audit | propose
	id?: string; // run_id filter (score) / attribution (friction)
	friction?: string; // record a friction note (CLI write path)
	responsibility?: string; // optional friction attribution
	commit?: boolean; // propose: persist to the advisory backlog (default dry-run)
	json?: boolean;
}

/** Find the nearest `.claude/` walking up from cwd. */
function findClaudeDir(): string | null {
	let cur = process.cwd();
	for (;;) {
		const candidate = path.join(cur, ".claude");
		if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
		const parent = path.dirname(cur);
		if (parent === cur) return null;
		cur = parent;
	}
}

/** Minimal redaction for the CLI friction write path (hooks scrub on their own path). */
function redact(msg: string): string {
	return msg
		.replace(/\b(sk|pk|ghp|gho|xox[baprs])[-_][A-Za-z0-9_-]{8,}\b/g, "[redacted]")
		.replace(/\b[A-Fa-f0-9]{32,}\b/g, "[redacted]")
		.replace(/((?:api[_-]?key|token|secret|password)\s*[=:]\s*)\S+/gi, "$1[redacted]");
}

function readLog(claudeDir: string): TraceRecord[] {
	const logPath = path.join(claudeDir, "memory", "trace-log.jsonl");
	if (!fs.existsSync(logPath)) return [];
	return parseTraceLog(fs.readFileSync(logPath, "utf-8"));
}

function recordFriction(claudeDir: string, opts: TraceOptions): void {
	const message = redact(opts.friction ?? "");
	const data: Record<string, unknown> = { message };
	if (opts.responsibility) data["responsibility"] = opts.responsibility;
	// Route through the ONE shared append primitive (lock + scrub + rotation) — no local append.
	appendTraceRecordSync(claudeDir, { event: "friction", runId: opts.id ?? "", data });
	console.log(
		`${pc.green("Recorded friction.")} ${pc.dim(opts.responsibility ? `[${opts.responsibility}] ` : "")}${message}`,
	);
}

function runScore(records: TraceRecord[], opts: TraceOptions): void {
	if (opts.id) {
		const filtered = records.filter((r) => r.run_id === opts.id);
		const s = scoreTier(filtered);
		if (opts.json) return void console.log(JSON.stringify({ run: opts.id, ...s }, null, 2));
		console.log(pc.bold(pc.cyan(`Trace score — run ${opts.id}`)));
		console.log(`  tier=${s.tier}  events=${s.events}  types=${s.types}  verified=${s.hasVerification}`);
		return;
	}
	const byRun = scoreByRun(records);
	if (opts.json) {
		console.log(JSON.stringify(Object.fromEntries(byRun), null, 2));
		return;
	}
	console.log(pc.bold(pc.cyan("Trace score — by lane (run)")));
	if (byRun.size === 0) {
		console.log(pc.dim("  no trace records yet."));
		return;
	}
	for (const [id, s] of byRun) console.log(`  ${pc.dim(id)}  tier=${s.tier}  events=${s.events}  types=${s.types}`);
}

function runAudit(records: TraceRecord[], opts: TraceOptions): void {
	const audit = auditTraces(records, { now: new Date() });
	if (opts.json) {
		console.log(JSON.stringify(audit, null, 2));
		return;
	}
	console.log(pc.bold(pc.cyan("Trace audit — entropy & drift")));
	console.log(
		`  records=${audit.total}  entropy=${audit.entropy} bits  orphaned=${audit.orphaned}  stale=${audit.stale}  unverified-runs=${audit.unverifiedRuns}`,
	);
	if (audit.repeatedFriction.length > 0) {
		console.log(pc.bold("  Repeated friction (≥2):"));
		for (const g of audit.repeatedFriction)
			console.log(
				`    ${pc.yellow(`×${g.count}`)} ${g.message}${g.responsibility ? pc.dim(` [${g.responsibility}]`) : ""}`,
			);
	} else {
		console.log(pc.dim("  No repeated friction."));
	}
}

function runPropose(claudeDir: string, records: TraceRecord[], opts: TraceOptions): void {
	const audit = auditTraces(records, { now: new Date() });
	const items = proposeImprovements(audit);
	if (opts.json) {
		console.log(JSON.stringify(items, null, 2));
		return;
	}
	console.log(pc.bold(pc.cyan(`Trace propose — ${items.length} advisory item(s)${opts.commit ? "" : " (dry-run)"}`)));
	for (const it of items)
		console.log(
			`  [${it.kind}] ${it.title} ${pc.dim(`(evidence ×${it.evidenceCount}${it.responsibility ? `, ${it.responsibility}` : ""})`)}`,
		);
	if (items.length === 0) console.log(pc.dim("  Nothing to propose — no repeated friction or drift."));

	if (opts.commit && items.length > 0) {
		const backlog = path.join(claudeDir, "memory", "improvement-backlog.md");
		fs.mkdirSync(path.dirname(backlog), { recursive: true });
		const stamp = new Date().toISOString().slice(0, 10);
		const lines = [`\n## ${stamp} — advisory proposals (trace propose)`];
		for (const it of items)
			lines.push(
				`- [${it.kind}] ${it.title} (evidence ×${it.evidenceCount}${it.responsibility ? `, ${it.responsibility}` : ""})`,
			);
		fs.appendFileSync(backlog, lines.join("\n") + "\n");
		console.log(pc.green(`\nAppended ${items.length} item(s) to ${backlog}`));
	} else if (!opts.commit) {
		console.log(pc.dim("\nRe-run with --commit to append these to the advisory backlog."));
	}
}

export function trace(opts: TraceOptions = {}): void {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error(pc.red("Could not find .claude/ directory."));
		process.exit(0); // advisory command — never a hard failure
	}

	// Friction write is a flag, not a subcommand: `mewkit trace --friction "..."`.
	if (typeof opts.friction === "string" && opts.friction.length > 0) {
		recordFriction(claudeDir, opts);
		return;
	}

	const records = readLog(claudeDir);
	switch (opts.subcommand) {
		case "score":
			runScore(records, opts);
			break;
		case "audit":
			runAudit(records, opts);
			break;
		case "propose":
			runPropose(claudeDir, records, opts);
			break;
		default:
			console.log(pc.bold(pc.cyan("mewkit trace")) + pc.dim(" — on-demand, advisory trace recall"));
			console.log("  trace score [--id <run>]      trace-quality tier per lane");
			console.log("  trace audit                   entropy + drift (orphaned/stale/unverified/friction)");
			console.log("  trace propose [--commit]      group repeated friction + drift into advisory items");
			console.log('  trace --friction "<note>" [--id <run>] [--responsibility <r>]   record friction (no hook needed)');
			break;
	}
}
