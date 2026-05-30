import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import pc from "picocolors";
import { validateMemory } from "../memory/validate.js";
import { seedFromMd } from "../memory/seed-from-md.js";
import { renderViews } from "../memory/render-views.js";

interface MemoryArgs {
	subcommand?: string;
	clear?: boolean;
	stats?: boolean;
	strict?: boolean;
	check?: boolean;
}

interface PatternEntry {
	timestamp?: string;
	[key: string]: unknown;
}

// Walks up at most 5 levels, stopping at a project root sentinel (CLAUDE.md or
// .claude/settings.json) so `mewkit memory --clear` can't reach a parent
// project's memory. Accepts optional startDir for testability; defaults to
// process.cwd().
export function findMemoryDir(startDir?: string): string | null {
	const PROJECT_ROOT_SENTINELS = ["CLAUDE.md", ".claude/settings.json"];
	let current = startDir ?? process.cwd();
	for (let depth = 0; depth < 5; depth++) {
		const candidate = path.join(current, ".claude", "memory");
		if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
			return candidate;
		}
		// Stop if we've reached a project root (has CLAUDE.md or .claude/settings.json)
		const atRoot = PROJECT_ROOT_SENTINELS.some((s) => fs.existsSync(path.join(current, s)));
		// Sentinel must fire at depth 0 too. If CWD has CLAUDE.md but no memory
		// dir, the walk must STOP here — not continue into the parent project.
		if (atRoot) return null;
		const parent = path.dirname(current);
		if (parent === current) return null; // filesystem root
		current = parent;
	}
	return null;
}

function promptConfirmation(question: string): Promise<boolean> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
		});
	});
}

// Writes valid schema v2.0.0 skeletons to the three split JSON files.
const EMPTY_SKELETON = (scope: string, consumer: string): string =>
	JSON.stringify(
		{
			version: "2.0.0",
			scope,
			consumer,
			patterns: [],
			metadata: {
				created: new Date().toISOString().split("T")[0],
				last_updated: new Date().toISOString().split("T")[0],
			},
		},
		null,
		2,
	);

const SPLIT_FILES = [
	{ file: "fixes.json", scope: "fixes", consumer: "mk:fix" },
	{
		file: "review-patterns.json",
		scope: "review-patterns",
		consumer: "mk:review,mk:plan-creator",
	},
	{
		file: "architecture-decisions.json",
		scope: "architecture-decisions",
		consumer: "mk:plan-creator,mk:cook",
	},
] as const;

async function clearMemory(memoryDir: string): Promise<void> {
	const confirmed = await promptConfirmation(
		pc.yellow("This will clear all learned patterns and lessons. Continue? (y/N) "),
	);

	if (!confirmed) {
		console.log(pc.dim("Aborted."));
		return;
	}

	// Clear v2 split files with valid skeletons
	for (const { file, scope, consumer } of SPLIT_FILES) {
		const p = path.join(memoryDir, file);
		if (fs.existsSync(p)) {
			fs.writeFileSync(p, EMPTY_SKELETON(scope, consumer), "utf-8");
			console.log(`  ${pc.green("Cleared")} ${file}`);
		}
	}

	// Clear topic markdown files
	const topicFiles = ["fixes.md", "review-patterns.md", "architecture-decisions.md", "security-notes.md"];
	for (const tf of topicFiles) {
		const p = path.join(memoryDir, tf);
		if (fs.existsSync(p)) {
			fs.writeFileSync(p, "", "utf-8");
			console.log(`  ${pc.green("Cleared")} ${tf}`);
		}
	}

	console.log();
	console.log(pc.green("Memory cleared."));
}

function showStats(memoryDir: string): void {
	let patternsCount = 0;
	let lastUpdated = "unknown";

	// Aggregate patterns across the three split files.
	for (const { file } of SPLIT_FILES) {
		const p = path.join(memoryDir, file);
		if (fs.existsSync(p)) {
			try {
				const content = fs.readFileSync(p, "utf-8");
				const data = JSON.parse(content) as { patterns?: PatternEntry[] };
				const entries = data.patterns ?? [];
				patternsCount += entries.length;
				for (const entry of entries) {
					const ts = (entry.lastSeen as string | undefined) ?? (entry.timestamp as string | undefined) ?? "";
					if (ts && (ts > lastUpdated || lastUpdated === "unknown")) {
						lastUpdated = ts;
					}
				}
			} catch {
				// Ignore parse errors
			}
		}
	}

	// Count entries in topic markdown files as proxy for "sessions"
	let sessionsCount = 0;
	for (const tf of ["fixes.md", "review-patterns.md", "architecture-decisions.md"]) {
		const p = path.join(memoryDir, tf);
		if (fs.existsSync(p)) {
			const content = fs.readFileSync(p, "utf-8");
			const headings = content.match(/^## /gm);
			sessionsCount += headings ? headings.length : 0;
		}
	}

	// Check file modification time as fallback for last updated
	if (lastUpdated === "unknown") {
		const files = SPLIT_FILES.map(({ file }) => path.join(memoryDir, file)).filter((f) => fs.existsSync(f));
		for (const file of files) {
			const stat = fs.statSync(file);
			const mtime = stat.mtime.toISOString();
			if (mtime > lastUpdated || lastUpdated === "unknown") {
				lastUpdated = mtime;
			}
		}
	}

	console.log(pc.bold("Memory Stats:"));
	console.log(`  ${pc.dim("Entries captured:")} ${pc.cyan(String(sessionsCount))}`);
	console.log(`  ${pc.dim("Patterns learned:")}  ${pc.cyan(String(patternsCount))}`);
	console.log(`  ${pc.dim("Last updated:")}      ${pc.cyan(lastUpdated === "unknown" ? "never" : lastUpdated)}`);
}

function showSummary(memoryDir: string): void {
	console.log(pc.bold("Memory Summary:"));
	console.log();

	// Topic markdown files
	for (const tf of ["fixes.md", "review-patterns.md", "architecture-decisions.md", "security-notes.md"]) {
		const p = path.join(memoryDir, tf);
		const label = `${tf}:`.padEnd(28);
		if (fs.existsSync(p)) {
			const content = fs.readFileSync(p, "utf-8");
			const lineCount = content.trim().length === 0 ? 0 : content.split("\n").length;
			console.log(`  ${pc.dim(label)} ${pc.cyan(`${lineCount} lines`)}`);
		} else {
			console.log(`  ${pc.dim(label)} ${pc.yellow("not found")}`);
		}
	}

	console.log();

	// Split JSON files — the canonical pattern/decision stores.
	for (const { file } of SPLIT_FILES) {
		const p = path.join(memoryDir, file);
		const label = `${file}:`.padEnd(28);
		if (fs.existsSync(p)) {
			try {
				const content = fs.readFileSync(p, "utf-8");
				const data = JSON.parse(content) as { patterns?: PatternEntry[] };
				const count = data.patterns?.length ?? 0;
				console.log(`  ${pc.dim(label)} ${pc.cyan(`${count} entries`)}`);
			} catch {
				console.log(`  ${pc.dim(label)} ${pc.red("invalid JSON")}`);
			}
		} else {
			console.log(`  ${pc.dim(label)} ${pc.yellow("not found")}`);
		}
	}
}

// `mewkit memory validate [--strict]` — Zod-validate the curated stores +
// re-run the injection-content guard per text field. Warn-only by default
// (exit 0); --strict exits nonzero when any error is present.
function validateCmd(memoryDir: string, strict: boolean): void {
	const report = validateMemory(memoryDir);

	for (const store of report.stores) {
		const label = `${store.file}:`.padEnd(28);
		if (store.issues.length === 0) {
			console.log(`  ${pc.dim(label)} ${pc.green(`OK (${store.entryCount} entries)`)}`);
			continue;
		}
		const worst = store.issues.some((i) => i.level === "error") ? pc.red("ISSUES") : pc.yellow("WARN");
		console.log(`  ${pc.dim(label)} ${worst}`);
		for (const issue of store.issues) {
			const tag = issue.level === "error" ? pc.red("error") : pc.yellow("warn");
			console.log(`      ${tag} ${issue.message}`);
		}
	}

	console.log();
	console.log(
		`${report.errorCount} error(s), ${report.warnCount} warning(s) across ${report.stores.length} curated stores.`,
	);

	if (strict && report.errorCount > 0) {
		console.log(pc.red("Strict mode: failing on errors."));
		process.exit(1);
	}
}

// `mewkit memory seed-from-md` — one-shot, additive, idempotent MD→JSON seeder.
function seedCmd(memoryDir: string): void {
	const results = seedFromMd(memoryDir);
	let totalAdded = 0;
	for (const r of results) {
		totalAdded += r.added;
		const label = `${r.file}:`.padEnd(28);
		const note = r.added > 0 ? pc.green(`+${r.added} (now ${r.total})`) : pc.dim(`unchanged (${r.total})`);
		console.log(`  ${pc.dim(label)} ${note}`);
	}
	console.log();
	console.log(
		totalAdded > 0
			? pc.green(`Seeded ${totalAdded} entr${totalAdded === 1 ? "y" : "ies"} from markdown.`)
			: pc.dim("Nothing to seed — JSON stores already current."),
	);
}

// `mewkit memory render-views [--check] [--strict]` — regenerate human-readable
// views/*.md from the canonical JSON. --check reports drift without writing (local
// dev only — views are gitignored, so this is NOT a CI gate). --strict exits
// nonzero when any entry is flagged by the injection-content recheck.
function renderViewsCmd(memoryDir: string, check: boolean, strict: boolean): void {
	const results = renderViews(memoryDir, { check });
	let staleCount = 0;
	let flaggedTotal = 0;

	for (const r of results) {
		const label = `${r.file.replace(/\.json$/, ".md")}:`.padEnd(28);
		const viewName = `views/${r.file.replace(/\.json$/, ".md")}`;
		if (check) {
			if (r.stale) {
				staleCount++;
				console.log(`  ${pc.dim(label)} ${pc.yellow(r.exists ? "STALE" : "MISSING")} ${pc.dim(viewName)}`);
			} else {
				console.log(`  ${pc.dim(label)} ${pc.green("up-to-date")}`);
			}
		} else {
			console.log(`  ${pc.dim(label)} ${r.wrote ? pc.green(`wrote ${viewName}`) : pc.dim("unchanged")}`);
		}
		if (r.flagged.length > 0) {
			flaggedTotal += r.flagged.length;
			console.log(`      ${pc.yellow("flagged")} ${r.flagged.join(", ")}`);
		}
	}

	console.log();
	if (check) {
		if (staleCount > 0) {
			console.log(pc.yellow(`${staleCount} view(s) stale — run 'mewkit memory render-views'.`));
			process.exit(1);
		}
		console.log(pc.green("All views up-to-date."));
	} else {
		console.log(pc.green("Views regenerated."));
	}

	if (strict && flaggedTotal > 0) {
		console.log(pc.red(`Strict mode: ${flaggedTotal} flagged entr${flaggedTotal === 1 ? "y" : "ies"}.`));
		process.exit(1);
	}
}

export async function memory(args: MemoryArgs): Promise<void> {
	console.log(pc.bold(pc.cyan("Agent Memory")));
	console.log();

	const memoryDir = findMemoryDir();

	if (!memoryDir) {
		console.error(pc.red("Could not find .claude/memory/ directory."));
		process.exit(1);
	}

	console.log(`${pc.dim("Location:")} ${memoryDir}`);
	console.log();

	if (args.subcommand === "validate") {
		validateCmd(memoryDir, args.strict ?? false);
	} else if (args.subcommand === "seed-from-md") {
		seedCmd(memoryDir);
	} else if (args.subcommand === "render-views") {
		renderViewsCmd(memoryDir, args.check ?? false, args.strict ?? false);
	} else if (args.clear) {
		await clearMemory(memoryDir);
	} else if (args.stats) {
		showStats(memoryDir);
	} else {
		showSummary(memoryDir);
	}
}
