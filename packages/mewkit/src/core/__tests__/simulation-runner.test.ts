import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { assertOutcome, runScenario, loadScenarioByName, listScenarios, hasHarness } from "../simulation-runner.js";
import { loadPackManifest } from "../pack-manifest.js";
import { resolveProfile } from "../pack-resolver.js";
import type { HookRunResult } from "../hook-runner.js";

const SRC_ROOT = process.cwd();

const mk = (over: Partial<HookRunResult>): HookRunResult => ({
	script: "gate-enforcement.sh",
	interpreter: "bash",
	status: 0,
	stdout: "",
	stderr: "",
	...over,
});

describe("assertOutcome", () => {
	it("PASS on a matching block (marker on the named stream + exit code)", () => {
		const r = mk({ status: 2, stderr: "@@GATE_BLOCK@@\nreason" });
		expect(assertOutcome(r, { blocked: true, marker: "@@GATE_BLOCK@@", exitCode: 2, expectStream: "stderr" }).status).toBe("PASS");
	});

	it("FAIL when the marker is on the wrong stream", () => {
		const r = mk({ status: 2, stdout: "@@GATE_BLOCK@@", stderr: "" });
		expect(assertOutcome(r, { blocked: true, marker: "@@GATE_BLOCK@@", exitCode: 2, expectStream: "stderr" }).status).toBe("FAIL");
	});

	it("PASS on an allow case (exit 0)", () => {
		expect(assertOutcome(mk({ status: 0 }), { blocked: false }).status).toBe("PASS");
	});

	it("SKIP on an allow case where NO hook ran (vacuous-pass guard)", () => {
		expect(assertOutcome(undefined, { blocked: false }).status).toBe("SKIP");
	});

	it("FAIL on a block case where NO hook ran", () => {
		expect(assertOutcome(undefined, { blocked: true, marker: "x" }).status).toBe("FAIL");
	});

	it("respects an explicit stdout stream", () => {
		const r = mk({ status: 1, stdout: "Prompt injection patterns detected" });
		expect(assertOutcome(r, { blocked: true, marker: "Prompt injection patterns detected", exitCode: 1, expectStream: "stdout" }).status).toBe("PASS");
	});
});

describe("scenario assets", () => {
	it("ships all six named scenarios", () => {
		const names = listScenarios(SRC_ROOT);
		for (const n of ["missing-plan", "privacy-env-read", "prompt-injection", "normal-bash", "review-fail", "full-lifecycle"]) {
			expect(names).toContain(n);
		}
	});

	it("installs the simulations into the core profile via base.globs", () => {
		const claudeDir = resolve(SRC_ROOT, ".claude");
		const manifest = loadPackManifest(claudeDir);
		const paths = resolveProfile(claudeDir, manifest, "core");
		expect([...paths].some((p) => p.startsWith("simulations/") && p.endsWith(".yaml"))).toBe(true);
	});

	it("full-lifecycle is genuinely multi-step", () => {
		const scenario = loadScenarioByName(SRC_ROOT, "full-lifecycle");
		expect(scenario.steps?.length ?? 0).toBeGreaterThanOrEqual(2);
	});
});

function hasPython3(): boolean {
	try {
		execSync("python3 --version", { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

const RUN = process.platform !== "win32" && hasHarness(SRC_ROOT) && hasPython3();
const d = RUN ? describe : describe.skip;

d("runScenario (integration)", () => {
	it("missing-plan blocks → PASS", () => {
		expect(runScenario(loadScenarioByName(SRC_ROOT, "missing-plan"), SRC_ROOT).status).toBe("PASS");
	});

	it("normal-bash allow → PASS (hook actually runs, not vacuous)", () => {
		expect(runScenario(loadScenarioByName(SRC_ROOT, "normal-bash"), SRC_ROOT).status).toBe("PASS");
	});

	it("full-lifecycle multi-step → PASS", () => {
		const result = runScenario(loadScenarioByName(SRC_ROOT, "full-lifecycle"), SRC_ROOT);
		expect(result.status).toBe("PASS");
		expect(result.steps).toHaveLength(3);
	});

	it("a deliberately-wrong expectation FAILs loudly", () => {
		// missing-plan but assert allow → must FAIL (the block fires).
		const scenario = { name: "bad", when: { tool: "Write", hook: "gate-enforcement.sh", file_path: "src/x.ts" }, expect: { blocked: false }, given: { clearPlans: true } };
		expect(runScenario(scenario, SRC_ROOT).status).toBe("FAIL");
	});

	it("an allow-case targeting a hook that never matches → SKIP (never vacuous PASS)", () => {
		const scenario = { name: "skip", when: { tool: "Read", hook: "gate-enforcement.sh", file_path: "README.md" }, expect: { blocked: false } };
		// gate-enforcement.sh is not registered for Read → no hook runs → SKIP.
		expect(runScenario(scenario, SRC_ROOT).status).toBe("SKIP");
	});
});
