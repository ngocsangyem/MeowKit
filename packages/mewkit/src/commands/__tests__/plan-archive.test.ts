import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { planArchive } from "../plan-archive.js";
import { writeActiveTaskPointer, readActiveTaskPointer, normalizeTaskId } from "../../core/task-record.js";

// `mewkit plan archive <plan-dir>` finishes a plan: stamps `status: completed` across
// plan.md + phase files + `.plan-state.json` phase statuses (preserving the visual
// block), leaves `visual-plan/plan.json` untouched, and moves the dir into
// `tasks/plans/archive/`.

let projectRoot: string;
let origCwd: string;

function makePlan(name: string, opts: { planState?: boolean; visual?: boolean } = {}): string {
	const dir = join(projectRoot, "tasks", "plans", name);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "plan.md"), "---\ntitle: X\nstatus: draft\n---\n\nBody with a later status: draft line.\n");
	writeFileSync(join(dir, "phase-01-setup.md"), "---\ntitle: P1\nstatus: pending\n---\n\n## Overview\n");
	writeFileSync(join(dir, "phase-02-build.md"), "---\ntitle: P2\nstatus: in-progress\n---\n\n## Overview\n");
	if (opts.planState) {
		writeFileSync(
			join(dir, ".plan-state.json"),
			JSON.stringify(
				{
					version: "1.3",
					planning_mode: "hard",
					phases: {
						"phase-01-setup": { status: "pending", tasks_completed: 0, tasks_total: 2 },
						"phase-02-build": { status: "in-progress", tasks_completed: 1, tasks_total: 3 },
					},
					visual: { schema: "visual-plan/v1", path: "visual-plan/plan.json", revision: 4, review_status: "approved" },
				},
				null,
				2,
			),
		);
	}
	if (opts.visual) {
		mkdirSync(join(dir, "visual-plan"));
		writeFileSync(join(dir, "visual-plan", "plan.json"), JSON.stringify({ review: { status: "approved" }, lanes: [] }));
	}
	return dir;
}

beforeEach(() => {
	origCwd = process.cwd();
	projectRoot = mkdtempSync(join(tmpdir(), "plan-archive-"));
	process.chdir(projectRoot);
	process.exitCode = 0;
});
afterEach(() => {
	process.chdir(origCwd);
	rmSync(projectRoot, { recursive: true, force: true });
	process.exitCode = 0;
});

describe("plan archive", () => {
	it("stamps completed across plan.md + phase files and moves the dir to archive/", async () => {
		makePlan("260101-1200-demo");
		await planArchive({ target: join(projectRoot, "tasks", "plans", "260101-1200-demo") });

		const dest = join(projectRoot, "tasks", "plans", "archive", "260101-1200-demo");
		expect(existsSync(join(projectRoot, "tasks", "plans", "260101-1200-demo"))).toBe(false); // moved
		expect(existsSync(dest)).toBe(true);

		const planMd = readFileSync(join(dest, "plan.md"), "utf-8");
		expect(planMd).toContain("status: completed");
		expect(planMd).toMatch(/^---[\s\S]*status: completed[\s\S]*?---/); // frontmatter block
		expect(planMd).toContain("Body with a later status: draft line."); // body untouched (only first block edited)

		expect(readFileSync(join(dest, "phase-01-setup.md"), "utf-8")).toContain("status: completed");
		expect(readFileSync(join(dest, "phase-02-build.md"), "utf-8")).toContain("status: completed");
		expect(process.exitCode).toBe(0);
	});

	it("marks .plan-state.json phase statuses completed while preserving the visual block + other keys", async () => {
		makePlan("260101-1300-state", { planState: true });
		await planArchive({ target: join(projectRoot, "tasks", "plans", "260101-1300-state") });

		const state = JSON.parse(
			readFileSync(join(projectRoot, "tasks", "plans", "archive", "260101-1300-state", ".plan-state.json"), "utf-8"),
		);
		expect(state.phases["phase-01-setup"].status).toBe("completed");
		expect(state.phases["phase-02-build"].status).toBe("completed");
		// Non-status fields preserved.
		expect(state.phases["phase-02-build"].tasks_completed).toBe(1);
		expect(state.planning_mode).toBe("hard");
		// CLI-managed visual block preserved verbatim.
		expect(state.visual).toEqual({
			schema: "visual-plan/v1",
			path: "visual-plan/plan.json",
			revision: 4,
			review_status: "approved",
		});
	});

	it("leaves visual-plan/plan.json untouched (review status is not lifecycle)", async () => {
		makePlan("260101-1400-visual", { visual: true });
		const before = readFileSync(
			join(projectRoot, "tasks", "plans", "260101-1400-visual", "visual-plan", "plan.json"),
			"utf-8",
		);
		await planArchive({ target: join(projectRoot, "tasks", "plans", "260101-1400-visual") });
		const after = readFileSync(
			join(projectRoot, "tasks", "plans", "archive", "260101-1400-visual", "visual-plan", "plan.json"),
			"utf-8",
		);
		expect(after).toBe(before);
	});

	it("--dry-run writes nothing and does not move the dir", async () => {
		const dir = makePlan("260101-1500-dry", { planState: true });
		await planArchive({ target: dir, dryRun: true });
		expect(existsSync(dir)).toBe(true); // not moved
		expect(existsSync(join(projectRoot, "tasks", "plans", "archive", "260101-1500-dry"))).toBe(false);
		expect(readFileSync(join(dir, "plan.md"), "utf-8")).toContain("status: draft"); // unchanged
	});

	it("fails closed when the archive destination already exists", async () => {
		const dir = makePlan("260101-1600-dup");
		mkdirSync(join(projectRoot, "tasks", "plans", "archive", "260101-1600-dup"), { recursive: true });
		await planArchive({ target: dir });
		expect(process.exitCode).toBe(1);
		expect(existsSync(dir)).toBe(true); // not moved
	});

	it("is a no-op when the plan is already under archive/", async () => {
		const dir = join(projectRoot, "tasks", "plans", "archive", "260101-1700-already");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "plan.md"), "---\nstatus: completed\n---\n");
		await planArchive({ target: dir });
		expect(process.exitCode).toBe(0);
		expect(existsSync(dir)).toBe(true); // still there, untouched
	});

	it("errors when the target is not a plan directory", async () => {
		mkdirSync(join(projectRoot, "tasks", "plans", "not-a-plan"), { recursive: true });
		await planArchive({ target: join(projectRoot, "tasks", "plans", "not-a-plan") });
		expect(process.exitCode).toBe(1);
	});

	it("preserves CRLF line endings when rewriting frontmatter status", async () => {
		const dir = join(projectRoot, "tasks", "plans", "260101-1900-crlf");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "plan.md"), "---\r\ntitle: X\r\nstatus: draft\r\n---\r\n\r\nBody line.\r\n");
		await planArchive({ target: dir });
		const out = readFileSync(join(projectRoot, "tasks", "plans", "archive", "260101-1900-crlf", "plan.md"), "utf-8");
		expect(out).toContain("status: completed\r\n"); // status line keeps CRLF
		expect(out).not.toContain("status: draft");
		expect(out).not.toMatch(/status: completed\n/); // no bare-LF regression on that line
	});

	it("clears a dangling active-task pointer that points at the archived plan", async () => {
		const name = "260101-1800-active";
		makePlan(name);
		await writeActiveTaskPointer(projectRoot, {
			taskId: normalizeTaskId(name),
			planPath: join("tasks", "plans", name, "plan.md"),
			planSlug: name,
		});
		expect(readActiveTaskPointer(projectRoot)?.kind).toBe("canonical");

		await planArchive({ target: join(projectRoot, "tasks", "plans", name) });
		expect(readActiveTaskPointer(projectRoot)).toBeNull(); // pointer cleared
	});
});
