import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import pc from "picocolors";

interface MemoryArgs {
	clear?: boolean;
	show?: boolean;
	stats?: boolean;
}

interface PatternEntry {
	timestamp?: string;
	[key: string]: unknown;
}

// H2 fix: caps walk at 5 levels; stops at project root sentinel (CLAUDE.md or
// .claude/settings.json) to prevent clearing a parent project's memory.
export function findMemoryDir(): string | null {
	const PROJECT_ROOT_SENTINELS = ["CLAUDE.md", ".claude/settings.json"];
	let current = process.cwd();
	for (let depth = 0; depth < 5; depth++) {
		const candidate = path.join(current, ".claude", "memory");
		if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
			return candidate;
		}
		// Stop if we've reached a project root (has CLAUDE.md or .claude/settings.json)
		const atRoot = PROJECT_ROOT_SENTINELS.some((s) =>
			fs.existsSync(path.join(current, s)),
		);
		if (atRoot && depth > 0) return null; // found root but no memory dir
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

// M2 fix: writes valid v2.0.0 skeletons to split files (was: "[]" which destroys schema).
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
	{ file: "fixes.json", scope: "fixes", consumer: "meow:fix" },
	{
		file: "review-patterns.json",
		scope: "review-patterns",
		consumer: "meow:review,meow:plan-creator",
	},
	{
		file: "architecture-decisions.json",
		scope: "architecture-decisions",
		consumer: "meow:plan-creator,meow:cook",
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

function showLessons(memoryDir: string): void {
	const lessonsPath = path.join(memoryDir, "lessons.md");

	if (!fs.existsSync(lessonsPath)) {
		console.log(pc.dim("No lessons.md file found."));
		return;
	}

	const content = fs.readFileSync(lessonsPath, "utf-8");

	if (content.trim().length === 0) {
		console.log(pc.dim("lessons.md is empty."));
		return;
	}

	console.log(pc.bold("Lessons:"));
	console.log();
	console.log(content);
}

function showStats(memoryDir: string): void {
	let patternsCount = 0;
	let lastUpdated = "unknown";

	// Aggregate patterns across all split files (M2 fix — no longer reads patterns.json)
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
		const files = SPLIT_FILES.map(({ file }) => path.join(memoryDir, file)).filter((f) =>
			fs.existsSync(f),
		);
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

	// Split JSON files (M2 fix — no longer reads patterns.json)
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

	if (args.clear) {
		await clearMemory(memoryDir);
	} else if (args.show) {
		showLessons(memoryDir);
	} else if (args.stats) {
		showStats(memoryDir);
	} else {
		showSummary(memoryDir);
	}
}
