/**
 * `.plan-state.json` additive `visual` block: the writer owns ONLY `visual` and
 * preserves every other field (read-modify-write), and derives the block from
 * the artifact.
 */

import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { VisualPlanSchema } from "../domain/schemas.js";
import { buildVisualBlock, writeVisualBlock, readPlanState } from "../infrastructure/plan-state.js";
import { makeValidPlan } from "../__fixtures__/valid-plan.js";
import { createPlanDir, stampFreshHashes, writePlanArtifact, cleanup } from "./plan-dir-helper.js";

const dirs: string[] = [];
afterEach(() => cleanup(dirs));

describe("writeVisualBlock", () => {
	it("preserves fields the CLI does not own", () => {
		const planDir = createPlanDir(dirs);
		const stateFile = path.join(planDir, ".plan-state.json");
		fs.writeFileSync(stateFile, JSON.stringify({ schema: "1.2", phases: [{ n: 1 }], handoff: { note: "keep me" } }));

		const artifact = makeValidPlan();
		stampFreshHashes(planDir, artifact);
		writePlanArtifact(planDir, artifact);
		writeVisualBlock(planDir, buildVisualBlock(VisualPlanSchema.parse(artifact), planDir));

		const state = readPlanState(planDir)!;
		expect(state.schema).toBe("1.2");
		expect(state.phases).toEqual([{ n: 1 }]);
		expect(state.handoff).toEqual({ note: "keep me" });
		expect((state.visual as Record<string, unknown>).schema).toBe("visual-plan/v1");
	});

	it("creates a minimal file when none exists", () => {
		const planDir = createPlanDir(dirs);
		const artifact = makeValidPlan();
		stampFreshHashes(planDir, artifact);
		writePlanArtifact(planDir, artifact);
		writeVisualBlock(planDir, buildVisualBlock(VisualPlanSchema.parse(artifact), planDir));

		const visual = (readPlanState(planDir)?.visual ?? {}) as Record<string, unknown>;
		expect(visual.path).toBe("visual-plan/plan.json");
		expect(visual.review_status).toBe("draft");
		expect(String(visual.hash)).toMatch(/^sha256:/);
	});
});
