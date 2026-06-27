import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { buildIndex, queryIndex } from "../core/derived-index.js";

// `mewkit index` / `mewkit query` — the opt-in derived SQLite index over the append logs.
// Build is explicit (never automatic, no hook). Query is read-only. Both advisory: exit 0,
// no gate. The DB is disposable — the logs remain canonical.

interface IndexOptions {
	json?: boolean;
}

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

export function indexCommand(opts: IndexOptions = {}): void {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error(pc.red("Could not find .claude/ directory."));
		process.exit(0);
	}
	const result = buildIndex(claudeDir);
	if (opts.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	console.log(pc.bold(pc.cyan("Derived index rebuilt")) + pc.dim(" (logs unchanged — canonical)"));
	console.log(`  ${pc.dim(result.dbPath)}`);
	console.log(`  schema v${result.schemaVersion} · ${result.traceRows} trace row(s) · ${result.costRows} cost row(s)`);
}

export function queryCommand(opts: IndexOptions = {}): void {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error(pc.red("Could not find .claude/ directory."));
		process.exit(0);
	}
	let result;
	try {
		result = queryIndex(claudeDir);
	} catch {
		console.log(pc.dim("No derived index yet — run `mewkit index` first (opt-in)."));
		return; // advisory: missing index is not an error
	}
	if (opts.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	console.log(pc.bold(pc.cyan(`Derived index query`)) + pc.dim(` (read-only, schema v${result.schemaVersion})`));
	console.log(pc.bold("  Events by type:"));
	for (const r of result.eventsByType.slice(0, 12)) console.log(`    ${r.n}× ${r.event}`);
	if (result.eventsByType.length === 0) console.log(pc.dim("    (none)"));
	if (result.frictionByResponsibility.length > 0) {
		console.log(pc.bold("  Friction by responsibility:"));
		for (const r of result.frictionByResponsibility) console.log(`    ${r.n}× ${r.responsibility}`);
	}
	if (result.costByModel.length > 0) {
		console.log(pc.bold("  Cost by model:"));
		for (const r of result.costByModel.slice(0, 12)) console.log(`    ${r.model || "(unknown)"}: ${r.entries} entr(ies), ${r.tokens} tokens`);
	}
}
