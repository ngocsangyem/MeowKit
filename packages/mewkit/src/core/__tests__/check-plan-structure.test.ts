import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { checkPlanStructure } from "../check-plan-structure.js";

function planDir(): string {
	const dir = path.join(mkdtempSync(path.join(tmpdir(), "plan-structure-")), "260101-fixture");
	mkdirSync(dir);
	writeFileSync(path.join(dir, "plan.md"), "---\ntitle: Fixture\nstatus: pending\n---\n\n# Fixture\n");
	return dir;
}

describe("checkPlanStructure", () => {
	it("reads a plan directory as its plan.md instead of failing on the directory", () => {
		const dir = planDir();
		const fromDir = checkPlanStructure(dir);
		expect(fromDir).toEqual(checkPlanStructure(path.join(dir, "plan.md")));
		expect(fromDir.issues.join("\n")).not.toMatch(/EISDIR/);
	});

	it("reports a missing path as one error", () => {
		const report = checkPlanStructure(path.join(tmpdir(), "no-such-plan-dir", "plan.md"));
		expect(report.errorCount).toBe(1);
		expect(report.complete).toBe(false);
	});
});
