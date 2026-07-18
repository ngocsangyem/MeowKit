// Phase 7 (MK-P0-06): the J10 deterministic layer runs a REAL migration into a codex target, then
// evaluates structural cross-harness parity via the machine oracles — no model calls, no network.
// Generating the target by real migration (not a snapshot) keeps parity honest as output evolves.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupKitInstallMigrateE2e, type MigrateE2eEnv } from "../../migrate/__tests__/helpers/migrate-e2e-harness.js";
import { evaluateCrossHarnessParity, type CrossHarnessResult } from "../deterministic-runner.js";
import { diffDurableSurfaces, snapshotDurableSurfaces } from "../side-effect-observer.js";

let env: MigrateE2eEnv;
let result: CrossHarnessResult;

beforeAll(async () => {
	env = await setupKitInstallMigrateE2e("j10-deterministic", "optimistic");
	const before = snapshotDurableSurfaces(env.projectDir);
	const exitCode = await env.run({ includeMcp: true });
	expect(exitCode).toBe(0);
	const after = snapshotDurableSurfaces(env.projectDir);
	result = await evaluateCrossHarnessParity({
		projectDir: env.projectDir,
		sideEffects: diffDurableSurfaces(before, after),
	});
}, 60_000);

afterAll(async () => {
	await env.cleanup();
});

describe("J10 deterministic cross-harness parity", () => {
	it("passes every deterministic oracle on a fresh migration (structural parity)", () => {
		expect(
			result.pass,
			result.oracles
				.filter((o) => !o.pass)
				.map((o) => `${o.name}: ${o.detail}`)
				.join("; "),
		).toBe(true);
	});

	it("runs all four named oracles at the deterministic layer", () => {
		expect(result.oracles.map((o) => o.name).sort()).toEqual([
			"artifact-set equivalence",
			"denied-token cleanliness",
			"route-table equivalence",
			"side-effect denial",
		]);
		expect(result.oracles.every((o) => o.layer === "deterministic")).toBe(true);
	});

	it("reports structural parity counts sourced from the migration report", () => {
		expect(result.structuralParity.routable).toBeGreaterThan(0);
		expect(result.structuralParity.migrated + result.structuralParity.documentedSkips).toBe(
			result.structuralParity.routable,
		);
	});

	it("migration produced no unrequested durable side effect", () => {
		expect(result.oracles.find((o) => o.name === "side-effect denial")?.pass).toBe(true);
	});
});
