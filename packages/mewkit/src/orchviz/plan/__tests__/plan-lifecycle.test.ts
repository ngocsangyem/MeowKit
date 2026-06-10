import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { completeAndArchivePlanIfDone } from "../plan-lifecycle.js";

let tmpProjectRoot: string | null = null;

afterEach(() => {
	if (tmpProjectRoot) {
		try {
			fs.rmSync(tmpProjectRoot, { recursive: true, force: true });
		} catch {
			/* best-effort */
		}
		tmpProjectRoot = null;
	}
});

function makePlan(phaseBodies: string[]): { plansDir: string; planDir: string } {
	tmpProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plan-lifecycle-"));
	const plansDir = path.join(tmpProjectRoot, "tasks", "plans");
	const planDir = path.join(plansDir, "260601-demo-plan");
	fs.mkdirSync(planDir, { recursive: true });
	fs.writeFileSync(path.join(planDir, "plan.md"), "---\ntitle: Demo\nstatus: in_progress\n---\n# Demo\n", "utf-8");
	phaseBodies.forEach((body, idx) => {
		const phaseNum = String(idx + 1).padStart(2, "0");
		fs.writeFileSync(path.join(planDir, `phase-${phaseNum}-work.md`), body, "utf-8");
	});
	return { plansDir, planDir };
}

describe("completeAndArchivePlanIfDone", () => {
	it("archives a plan after every non-abandoned phase todo is checked", () => {
		const { plansDir, planDir } = makePlan([
			"---\nstatus: completed\n---\n# Phase 1\n\n## Todo List\n\n- [x] Done A\n",
			"---\nstatus: completed\n---\n# Phase 2\n\n## Todo List\n\n- [x] Done B\n",
		]);

		const result = completeAndArchivePlanIfDone(planDir, plansDir);

		expect(result.archived).toBe(true);
		const archiveDir = path.join(plansDir, "archive", "260601-demo-plan");
		expect(fs.existsSync(planDir)).toBe(false);
		expect(fs.existsSync(archiveDir)).toBe(true);
		expect(fs.readFileSync(path.join(archiveDir, "plan.md"), "utf-8")).toContain("status: completed");
	});

	it("does not archive while any todo remains unchecked", () => {
		const { plansDir, planDir } = makePlan(["# Phase 1\n\n## Todo List\n\n- [x] Done\n- [ ] Not done\n"]);

		const result = completeAndArchivePlanIfDone(planDir, plansDir);

		expect(result).toEqual({ archived: false, reason: "not-complete" });
		expect(fs.existsSync(planDir)).toBe(true);
		expect(fs.existsSync(path.join(plansDir, "archive"))).toBe(false);
	});
});
