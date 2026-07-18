/**
 * End-to-end validation against a real plan directory: the valid fixture
 * passes, and every failure class the phase enumerates fails with the right
 * code — dangling refs, unresolved coverage, unsafe HTML, oversized HTML,
 * duplicate id, stale source hash, missing artifact, invalid JSON.
 */

import { describe, expect, it, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { validatePlan } from "../application/validate-plan.js";
import { ErrorCode } from "../domain/errors.js";
import { CAPS } from "../domain/schemas.js";
import { makeValidPlan } from "../__fixtures__/valid-plan.js";
import { createPlanDir, stampFreshHashes, writePlanArtifact, cleanup } from "./plan-dir-helper.js";

const dirs: string[] = [];
afterEach(() => cleanup(dirs));

/** Write a fresh-hashed artifact (optionally mutated) into a new plan dir. */
function seed(mutate?: (p: Record<string, unknown>) => void): string {
	const planDir = createPlanDir(dirs);
	const artifact = makeValidPlan();
	if (mutate) mutate(artifact);
	stampFreshHashes(planDir, artifact);
	writePlanArtifact(planDir, artifact);
	return planDir;
}

describe("validatePlan — valid fixture", () => {
	it("passes and reports computed coverage", () => {
		const r = validatePlan(seed());
		expect(r.ok).toBe(true);
		expect(r.errors).toEqual([]);
		expect(r.coverage).toEqual({ total: 4, resolved: 1, planned: 1, omitted: 2, unresolved: 0 });
	});
});

describe("validatePlan — artifact presence", () => {
	it("reports ARTIFACT_MISSING when no artifact exists", () => {
		const planDir = createPlanDir(dirs);
		expect(validatePlan(planDir).errors[0].code).toBe(ErrorCode.ARTIFACT_MISSING);
	});

	it("reports ARTIFACT_INVALID_JSON for malformed JSON", () => {
		const planDir = createPlanDir(dirs);
		fs.writeFileSync(path.join(planDir, "visual-plan", "plan.json"), "{ not json");
		expect(validatePlan(planDir).errors[0].code).toBe(ErrorCode.ARTIFACT_INVALID_JSON);
	});
});

describe("validatePlan — failure classes", () => {
	it("SCHEMA on an invalid surface enum", () => {
		const planDir = seed((p) => {
			(p.canvas as { frames: { surface: string }[] }).frames[0].surface = "hologram";
		});
		expect(validatePlan(planDir).errors.some((e) => e.code === ErrorCode.SCHEMA)).toBe(true);
	});

	it("DUPLICATE_ID via full pipeline", () => {
		const planDir = seed((p) => {
			(p.canvas as { frames: { id: string }[] }).frames[1].id = "fr-login";
		});
		expect(validatePlan(planDir).errors.some((e) => e.code === ErrorCode.DUPLICATE_ID)).toBe(true);
	});

	it("DANGLING_CONNECTOR_ENDPOINT with exact path", () => {
		const planDir = seed((p) => {
			(p.canvas as { connectors: { to: string }[] }).connectors[0].to = "fr-ghost";
		});
		const e = validatePlan(planDir).errors.find((x) => x.code === ErrorCode.DANGLING_CONNECTOR_ENDPOINT);
		expect(e?.path).toBe("canvas.connectors[0].to");
	});

	it("COVERAGE_UNRESOLVED when a state closes via no mode", () => {
		const planDir = seed((p) => {
			(p.uiCoverage as { surfaces: { states: { frameIds: string[] }[] }[] }).surfaces[0].states[0].frameIds = [];
		});
		expect(validatePlan(planDir).errors.some((e) => e.code === ErrorCode.COVERAGE_UNRESOLVED)).toBe(true);
	});

	it("UNSAFE_HTML on a scripted wireframe", () => {
		const planDir = seed((p) => {
			(p.canvas as { frames: { wireframe: { html: string } }[] }).frames[0].wireframe.html =
				"<div>x<script>alert(1)</script></div>";
		});
		const e = validatePlan(planDir).errors.find((x) => x.code === ErrorCode.UNSAFE_HTML);
		expect(e?.path).toBe("canvas.frames[0].wireframe.html");
	});

	it("SCHEMA (oversized) on wireframe HTML over the byte cap", () => {
		const planDir = seed((p) => {
			(p.canvas as { frames: { wireframe: { html: string } }[] }).frames[0].wireframe.html =
				"<div>" + "a".repeat(CAPS.HTML_BYTES + 10) + "</div>";
		});
		const e = validatePlan(planDir).errors.find((x) => x.path === "canvas.frames[0].wireframe.html");
		expect(e?.code).toBe(ErrorCode.SCHEMA);
	});

	it("STALE_SOURCE_HASH after plan.md is edited post-generation", () => {
		const planDir = seed();
		fs.appendFileSync(path.join(planDir, "plan.md"), "\nEdited after generation.\n");
		const e = validatePlan(planDir).errors.find((x) => x.code === ErrorCode.STALE_SOURCE_HASH);
		expect(e?.path).toBe("source.planHash");
	});
});
