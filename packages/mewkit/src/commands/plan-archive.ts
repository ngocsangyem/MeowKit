import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { readActiveTaskPointer, clearActiveTaskPointer } from "../core/task-record.js";

// `mewkit plan archive <plan-dir|plan.md>` — finish + archive a plan.
//
// This is a MUTATION and deliberately lives OUTSIDE plan.ts, which is read-only by
// construction. Mirrors the `plan approve` split: `plan status`/`plan check` still
// cannot write, and archiving is a separate, explicitly-named command.
//
// What it does, in order:
//   1. Stamp `status: completed` across plan.md + every phase-*.md frontmatter, and every
//      `phases[*].status` in `.plan-state.json` (the plan-creator checkpoint).
//   2. Clear a dangling active-task pointer that still points at this plan.
//   3. Move the whole plan directory into `tasks/plans/archive/<name>/`.
//
// The CLI-managed `.plan-state.json` `visual` block and the visual canvas
// (`visual-plan/plan.json`) are lifecycle-agnostic — they are preserved verbatim
// and travel with the directory. Only per-phase `status` fields are rewritten.

export interface PlanArchiveArgs {
	/** Plan directory or a plan.md path inside it. */
	target?: string;
	/** Preview only — no files written or moved. */
	dryRun?: boolean;
}

const COMPLETED = "completed";

interface ArchiveReport {
	planDir: string;
	dest: string;
	planMdUpdated: boolean;
	phasesUpdated: number;
	phaseFilesTotal: number;
	planStateUpdated: boolean;
	pointerCleared: boolean;
}

/** Resolve a plan directory from a dir path or a `plan.md` path. Throws if it is not a plan dir.
 *  Returns a canonical (symlink-resolved) path so containment checks compare like with like. */
function resolvePlanDir(target: string): string {
	const resolved = path.resolve(target);
	if (!fs.existsSync(resolved)) throw new Error(`not found: ${target}`);
	const dir = fs.statSync(resolved).isDirectory() ? resolved : path.dirname(resolved);
	if (!fs.existsSync(path.join(dir, "plan.md"))) throw new Error(`no plan.md in ${dir} — not a plan directory`);
	return fs.realpathSync(dir);
}

/**
 * Set the `status:` field to `completed` inside the FIRST frontmatter block only.
 * The frontmatter sits at the top of the file, so the first line-anchored `status:`
 * IS the frontmatter's — an identical `status:` in the body is never reached. The
 * rewrite matches only the line's value (`[^\r\n]*`, leaving any trailing `\r`
 * intact) and touches nothing else, so the file's line endings are preserved.
 * Returns true when a change was made.
 */
function setFrontmatterStatusCompleted(mdPath: string, write: boolean): boolean {
	if (!fs.existsSync(mdPath)) return false;
	const content = fs.readFileSync(mdPath, "utf-8");
	const firstBlock = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!firstBlock || !/^status:/m.test(firstBlock[1])) return false; // no frontmatter status to set
	const next = content.replace(/^status:[^\r\n]*/m, `status: ${COMPLETED}`);
	if (next === content) return false;
	if (write) fs.writeFileSync(mdPath, next, "utf-8");
	return true;
}

/**
 * Mark every `phases[*].status` completed in `.plan-state.json`, preserving every other key
 * (including the CLI-managed `visual` block). Returns true when a change was made.
 */
function markPlanStateCompleted(planStatePath: string, write: boolean): boolean {
	if (!fs.existsSync(planStatePath)) return false;
	let data: Record<string, unknown>;
	try {
		data = JSON.parse(fs.readFileSync(planStatePath, "utf-8")) as Record<string, unknown>;
	} catch {
		return false; // malformed checkpoint — leave it, the markdown is authoritative
	}
	const phases = data.phases;
	if (!phases || typeof phases !== "object" || Array.isArray(phases)) return false;
	let changed = false;
	for (const phase of Object.values(phases as Record<string, unknown>)) {
		if (phase && typeof phase === "object" && !Array.isArray(phase)) {
			const record = phase as Record<string, unknown>;
			if (record.status !== COMPLETED) {
				record.status = COMPLETED;
				changed = true;
			}
		}
	}
	if (changed && write) fs.writeFileSync(planStatePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
	return changed;
}

/** Clear the active-task pointer only when it canonically points at this plan. Best-effort. */
async function clearPointerIfHere(projectRoot: string, slug: string, write: boolean): Promise<boolean> {
	if (!write) return false;
	const pointer = readActiveTaskPointer(projectRoot);
	if (pointer?.kind !== "canonical" || pointer.pointer.planSlug !== slug) return false;
	try {
		return await clearActiveTaskPointer(projectRoot, pointer.pointer.taskId);
	} catch {
		return false; // advisory: a pointer-clear failure never blocks the archive
	}
}

function printReport(report: ArchiveReport, projectRoot: string, dryRun: boolean): void {
	const rel = (p: string) => path.relative(projectRoot, p) || p;
	console.log(pc.bold(dryRun ? "Plan archive (dry-run)" : "Plan archived"));
	console.log(`  ${pc.dim("plan:")}    ${rel(report.planDir)}`);
	console.log(`  ${pc.dim("→ dest:")}  ${rel(report.dest)}`);
	console.log(
		`  ${pc.dim("plan.md:")} ${report.planMdUpdated ? pc.green("status → completed") : pc.dim("no status field")}`,
	);
	console.log(
		`  ${pc.dim("phases:")}  ${pc.green(`${report.phasesUpdated}`)}/${report.phaseFilesTotal} set to completed`,
	);
	if (report.planStateUpdated)
		console.log(`  ${pc.dim(".plan-state.json:")} phase statuses → completed (visual block preserved)`);
	if (report.pointerCleared) console.log(`  ${pc.dim("active pointer:")} cleared`);
	if (dryRun) console.log(pc.dim("\n  (dry-run — no files written or moved)"));
}

export async function planArchive(args: PlanArchiveArgs): Promise<void> {
	const dryRun = args.dryRun ?? false;
	if (!args.target) {
		console.log(pc.red("plan archive: missing <plan-dir>"));
		process.exitCode = 1;
		return;
	}

	// Canonical project root so the archive-containment check compares symlink-resolved
	// paths against the (also-resolved) plan dir — avoids /var vs /private/var mismatches.
	const projectRoot = fs.realpathSync(process.cwd());
	const archiveRoot = path.join(projectRoot, "tasks", "plans", "archive");

	let planDir: string;
	try {
		planDir = resolvePlanDir(args.target);
	} catch (error) {
		console.log(pc.red(`plan archive: ${error instanceof Error ? error.message : String(error)}`));
		process.exitCode = 1;
		return;
	}

	// Already under archive/ → nothing to do (idempotent, not an error).
	if (`${planDir}${path.sep}`.startsWith(`${path.resolve(archiveRoot)}${path.sep}`)) {
		console.log(pc.yellow(`plan archive: ${path.basename(planDir)} is already archived — nothing to do.`));
		process.exitCode = 0;
		return;
	}

	const name = path.basename(planDir);
	const dest = path.join(archiveRoot, name);
	if (fs.existsSync(dest)) {
		console.log(pc.red(`plan archive: ${path.relative(projectRoot, dest)} already exists — refusing to overwrite.`));
		process.exitCode = 1;
		return;
	}

	const phaseFiles = fs.readdirSync(planDir).filter((f) => /^phase-.*\.md$/.test(f));
	const planMdUpdated = setFrontmatterStatusCompleted(path.join(planDir, "plan.md"), !dryRun);
	let phasesUpdated = 0;
	for (const file of phaseFiles) {
		if (setFrontmatterStatusCompleted(path.join(planDir, file), !dryRun)) phasesUpdated++;
	}
	const planStateUpdated = markPlanStateCompleted(path.join(planDir, ".plan-state.json"), !dryRun);
	const pointerCleared = await clearPointerIfHere(projectRoot, name, !dryRun);

	if (!dryRun) {
		fs.mkdirSync(archiveRoot, { recursive: true });
		fs.renameSync(planDir, dest);
	}

	printReport(
		{
			planDir,
			dest,
			planMdUpdated,
			phasesUpdated,
			phaseFilesTotal: phaseFiles.length,
			planStateUpdated,
			pointerCleared,
		},
		projectRoot,
		dryRun,
	);
	process.exitCode = 0;
}
