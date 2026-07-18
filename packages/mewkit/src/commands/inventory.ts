import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { buildInventory, type InventoryEntry } from "../core/build-inventory.js";
import { checkStaleIndex, emitCounts } from "../core/check-stale-index.js";
import { aggregateSubstrate, emitSubstrateView, type Coverage } from "../core/substrate.js";

interface InventoryOptions {
	json?: boolean;
	stale?: boolean;
	critical?: boolean;
	portableMissing?: boolean;
	/** Compare README/index declared counts against the inventory (CI; exits 1 on drift). */
	check?: boolean;
	/** Rewrite count number tokens in README/index headers to match reality. */
	emitCounts?: boolean;
	/** Print the responsibility×coverage substrate matrix (generated from the registry). */
	substrate?: boolean;
	/** With --substrate: rewrite the committed .claude/harness-substrate.md view. */
	emit?: boolean;
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

function coverageCell(c: Coverage): string {
	if (c === "covered") return pc.green(pad("covered", 9));
	if (c === "partial") return pc.yellow(pad("partial", 9));
	return pc.dim(pad("missing", 9));
}

function renderSubstrate(agg: ReturnType<typeof aggregateSubstrate>): void {
	console.log(pc.bold(pc.cyan("Harness responsibility substrate")));
	const covered = agg.rows.filter((r) => r.coverage === "covered").length;
	console.log(pc.dim(`${agg.totalArtifacts} artifacts — ${covered}/${agg.rows.length} responsibilities covered`));
	console.log();
	console.log(
		pc.bold(`  ${pad("RESPONSIBILITY", 24)} ${pad("COVERAGE", 9)} ${pad("TAGGED", 7)} ${pad("ACTIVE", 7)} EXAMPLES`),
	);
	for (const r of agg.rows) {
		const label = r.core ? r.label : `${r.label} (kit)`;
		console.log(
			`  ${pad(label, 24)} ${coverageCell(r.coverage)} ${pad(String(r.count), 7)} ${pad(String(r.active), 7)} ${pc.dim(r.examples.join(", ") || "—")}`,
		);
	}
	console.log();
	console.log(
		pc.dim(
			`Untagged: ${agg.untaggedRegistry.length} registry + ${agg.untaggedFrontmatter.length} frontmatter (tag-on-touch).`,
		),
	);
	if (agg.invalid.length > 0) {
		console.log(
			pc.yellow(
				`${agg.invalid.length} artifact(s) carry an out-of-enum responsibility — run \`mewkit validate --substrate\`.`,
			),
		);
	}
}

export async function inventory(opts: InventoryOptions = {}): Promise<void> {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error(pc.red("Could not find .claude/ directory in the current directory."));
		process.exit(1);
	}

	const repoRoot = path.dirname(claudeDir);

	if (opts.substrate) {
		if (opts.emit) {
			const written = emitSubstrateView(claudeDir);
			console.log(`${pc.green("Wrote substrate view:")} ${written}`);
			return;
		}
		const agg = aggregateSubstrate(claudeDir);
		if (opts.json) {
			console.log(JSON.stringify(agg, null, 2));
			return;
		}
		renderSubstrate(agg);
		return;
	}

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
			console.log(
				pc.red(
					`${fails.length} drift/incompleteness issue(s). Run \`mewkit inventory --emit-counts\` for numbers; add missing rows by hand.`,
				),
			);
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
