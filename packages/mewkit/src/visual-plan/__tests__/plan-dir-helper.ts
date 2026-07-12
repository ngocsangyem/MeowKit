/**
 * Test helper: materialize a real plan directory on disk so source-hash
 * freshness and realpath containment are exercised for real (not mocked).
 *
 * `createPlanDir` writes `plan.md` + `phase-01-*.md` + an empty `visual-plan/`.
 * `stampFreshHashes` fills the artifact's `source` with hashes matching those
 * on-disk files, so a valid fixture passes freshness. Callers register the
 * returned dir for cleanup via the array they pass in.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { computeSourceHashes } from "../infrastructure/hashing.js";
import { writeArtifact, artifactPath } from "../infrastructure/visual-plan-repository.js";
import { FIXTURE_PLAN_MD, FIXTURE_PHASE_MD } from "../__fixtures__/valid-plan.js";

/** Create a tmp plan dir with plan.md + one phase file + a visual-plan/ subdir. */
export function createPlanDir(registry: string[]): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vp-test-"));
	registry.push(dir);
	fs.writeFileSync(path.join(dir, "plan.md"), FIXTURE_PLAN_MD);
	fs.writeFileSync(path.join(dir, "phase-01-login.md"), FIXTURE_PHASE_MD);
	fs.mkdirSync(path.join(dir, "visual-plan"));
	return dir;
}

/** Mutate `artifact.source` in place with hashes matching the on-disk Markdown. */
export function stampFreshHashes(planDir: string, artifact: Record<string, unknown>): void {
	const src = artifact.source as { planPath: string; planHash: string; phaseHashes: Record<string, string> };
	const fresh = computeSourceHashes(planDir, src.planPath);
	src.planHash = fresh.planHash;
	src.phaseHashes = fresh.phaseHashes;
}

/** Write the artifact JSON to `<planDir>/visual-plan/plan.json`. */
export function writePlanArtifact(planDir: string, artifact: unknown): void {
	writeArtifact(planDir, artifact);
}

/** Read the artifact JSON back (post-mutation assertions). */
export function readPlanArtifact(planDir: string): Record<string, unknown> {
	return JSON.parse(fs.readFileSync(artifactPath(planDir), "utf-8")) as Record<string, unknown>;
}

/** Remove every dir registered during a test run. */
export function cleanup(registry: string[]): void {
	for (const dir of registry.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}
