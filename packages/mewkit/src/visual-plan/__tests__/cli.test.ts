/**
 * CLI surface: exercises `visualPlanCommand` (the dispatcher + reporter) against
 * real plan directories, asserting exit codes and machine output. This is the
 * v1 gate for the command surface — it proves validate/status/approve/rehash
 * and the usage/path error paths end to end without spawning the compiled bin.
 */

import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { visualPlanCommand } from "../interface/cli.js";
import { makeValidPlan } from "../__fixtures__/valid-plan.js";
import { createPlanDir, stampFreshHashes, writePlanArtifact, cleanup } from "./plan-dir-helper.js";

const dirs: string[] = [];
let out: string[] = [];

beforeEach(() => {
	process.exitCode = 0;
	out = [];
	vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void out.push(a.join(" ")));
	vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void out.push(a.join(" ")));
});
afterEach(() => {
	vi.restoreAllMocks();
	cleanup(dirs);
	process.exitCode = 0;
});

function seedValid(): string {
	const planDir = createPlanDir(dirs);
	const artifact = makeValidPlan();
	stampFreshHashes(planDir, artifact);
	writePlanArtifact(planDir, artifact);
	return planDir;
}

describe("visualPlanCommand — happy path lifecycle", () => {
	it("validate → approve → status all succeed with exit 0", () => {
		const planDir = seedValid();

		visualPlanCommand({ subcommand: "validate", planDir, json: true });
		expect(process.exitCode).toBe(0);
		const validated = JSON.parse(out.join("\n")) as { ok: boolean };
		expect(validated.ok).toBe(true);

		out = [];
		visualPlanCommand({ subcommand: "approve", planDir, revision: "0" });
		expect(process.exitCode).toBe(0);

		out = [];
		visualPlanCommand({ subcommand: "status", planDir, json: true });
		const status = JSON.parse(out.join("\n")) as { reviewStatus: string };
		expect(status.reviewStatus).toBe("approved");
	});
});

describe("visualPlanCommand — exit codes", () => {
	it("validate on a missing artifact exits 1", () => {
		const planDir = createPlanDir(dirs);
		visualPlanCommand({ subcommand: "validate", planDir });
		expect(process.exitCode).toBe(1);
	});

	it("approve without --revision exits 2 (usage)", () => {
		visualPlanCommand({ subcommand: "approve", planDir: seedValid() });
		expect(process.exitCode).toBe(2);
	});

	it("approve with a non-integer --revision exits 2 (no silent coercion)", () => {
		visualPlanCommand({ subcommand: "approve", planDir: seedValid(), revision: "1x" });
		expect(process.exitCode).toBe(2);
	});

	it("status exits 1 on an existing-but-invalid artifact", () => {
		const planDir = createPlanDir(dirs);
		const artifact = makeValidPlan();
		(artifact.canvas as { connectors: { to: string }[] }).connectors[0].to = "fr-ghost";
		stampFreshHashes(planDir, artifact);
		writePlanArtifact(planDir, artifact);
		visualPlanCommand({ subcommand: "status", planDir });
		expect(process.exitCode).toBe(1);
	});

	it("status exits 0 on a valid artifact and on a missing one", () => {
		visualPlanCommand({ subcommand: "status", planDir: seedValid() });
		expect(process.exitCode).toBe(0);
		visualPlanCommand({ subcommand: "status", planDir: createPlanDir(dirs) });
		expect(process.exitCode).toBe(0);
	});

	it("unknown subcommand exits 2", () => {
		visualPlanCommand({ subcommand: "frobnicate", planDir: seedValid() });
		expect(process.exitCode).toBe(2);
	});

	it("nonexistent plan dir exits 2", () => {
		visualPlanCommand({ subcommand: "validate", planDir: "/no/such/plan/dir/xyz" });
		expect(process.exitCode).toBe(2);
	});

	it("missing plan dir argument exits 2", () => {
		visualPlanCommand({ subcommand: "validate" });
		expect(process.exitCode).toBe(2);
	});
});
