import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { buildInventory, type InventoryEntry } from "../core/build-inventory.js";
import { checkStaleIndex, emitCounts } from "../core/check-stale-index.js";

interface InventoryOptions {
	json?: boolean;
	stale?: boolean;
	critical?: boolean;
	portableMissing?: boolean;
	/** Compare README/index declared counts against the inventory (CI; exits 1 on drift). */
	check?: boolean;
	/** Rewrite count number tokens in README/index headers to match reality. */
	emitCounts?: boolean;
}

function findClaudeDir(): string | null {
	const candidate = path.join(process.cwd(), ".claude");
	return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() ? candidate : null;
}

function applyFilter(entries: InventoryEntry[], opts: InventoryOptions): InventoryEntry[] {
	let out = entries;
	if (opts.stale) out = out.filter((e) => e.status === "deprecated" || e.status === "experimental");
	if (opts.critical) out = out.filter((e) => e.criticality === "critical");
	if (opts.portableMissing) out = out.filter((e) => e.runtime !== "portable");
	return out;
}

function pad(s: string, n: number): string {
	return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function renderTable(entries: InventoryEntry[]): void {
	console.log(
		pc.bold(`  ${pad("TYPE", 8)} ${pad("ID", 26)} ${pad("OWNER", 13)} ${pad("CRIT", 9)} ${pad("STATUS", 12)} RUNTIME`),
	);
	for (const e of entries) {
		const crit =
			e.criticality === "critical"
				? pc.red(pad(e.criticality, 9))
				: e.criticality === "high"
					? pc.yellow(pad(e.criticality, 9))
					: pad(e.criticality, 9);
		console.log(`  ${pad(e.type, 8)} ${pad(e.id, 26)} ${pad(e.owner, 13)} ${crit} ${pad(e.status, 12)} ${e.runtime}`);
	}
}

export async function inventory(opts: InventoryOptions = {}): Promise<void> {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error(pc.red("Could not find .claude/ directory in the current directory."));
		process.exit(1);
	}

	const repoRoot = path.dirname(claudeDir);

	if (opts.emitCounts) {
		const changed = emitCounts(repoRoot);
		if (changed.length === 0) console.log(pc.dim("Counts already match the inventory — nothing to rewrite."));
		else console.log(`${pc.green("Updated count tokens in:")} ${changed.join(", ")}`);
		return;
	}

	if (opts.check) {
		const results = checkStaleIndex(repoRoot);
		const fails = results.filter((r) => r.status === "fail");
		console.log(pc.bold(pc.cyan("Stale-index check (README + indexes vs inventory)")));
		for (const r of results) {
			const icon = r.status === "fail" ? pc.red("FAIL") : pc.green("PASS");
			console.log(`  [${icon}] ${r.name}`);
			if (r.status === "fail") console.log(`         ${pc.dim(r.detail)}`);
		}
		console.log();
		if (fails.length > 0) {
			console.log(pc.red(`${fails.length} drift/incompleteness issue(s). Run \`mewkit inventory --emit-counts\` for numbers; add missing rows by hand.`));
			process.exit(1);
		}
		console.log(pc.green("Docs match the inventory."));
		return;
	}

	const { entries, issues } = buildInventory(claudeDir);
	const filtered = applyFilter(entries, opts);

	if (opts.json) {
		console.log(JSON.stringify(filtered, null, 2));
		return;
	}

	const byType = (t: string) => entries.filter((e) => e.type === t).length;
	console.log(pc.bold(pc.cyan("MeowKit harness inventory")));
	console.log(
		pc.dim(
			`${entries.length} artifacts — ${byType("skill")} skills, ${byType("agent")} agents, ${byType("rule")} rules, ${byType("command")} commands, ${byType("hook")} hooks`,
		),
	);
	console.log();
	renderTable(filtered);
	console.log();
	console.log(pc.dim(`${filtered.length} shown`));

	if (issues.length > 0) {
		console.log();
		console.log(pc.yellow(`${issues.length} metadata issue(s) — run \`mewkit validate --ownership\` for details.`));
	}
}
