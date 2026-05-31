import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the heavy/external producers; keep readEvents (event-log) real against a temp log.
vi.mock("../doctor-hard-gates.js", () => ({ checkHardGates: vi.fn() }));
vi.mock("../doctor-memory-checks.js", () => ({ checkMemoryHealth: vi.fn() }));
vi.mock("../../core/build-inventory.js", () => ({ buildInventory: vi.fn() }));
vi.mock("../../core/check-stale-index.js", () => ({ checkStaleIndex: vi.fn() }));
vi.mock("../../core/context-budget.js", () => ({ computeContextBudget: vi.fn() }));
vi.mock("../../core/install-metadata.js", () => ({ readInstallMetadata: vi.fn() }));
vi.mock("../../migrate/provider-contract-diagnostics.js", () => ({ collectProviderContractDiagnostics: vi.fn(() => []) }));

import { health } from "../health.js";
import { checkHardGates } from "../doctor-hard-gates.js";
import { checkMemoryHealth } from "../doctor-memory-checks.js";
import { buildInventory } from "../../core/build-inventory.js";
import { checkStaleIndex } from "../../core/check-stale-index.js";
import { computeContextBudget } from "../../core/context-budget.js";
import { readInstallMetadata } from "../../core/install-metadata.js";

const tempDirs: string[] = [];
let cwdSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let chunks: string[];

const rec = (event: string, data: Record<string, unknown> = {}): string =>
	JSON.stringify({ schema_version: "1.0", ts: new Date().toISOString().replace(/\.\d+Z$/, "Z"), event, data });

function setupRepo(traceLines: string[], capLine = "--fail-over 130000"): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-health-"));
	tempDirs.push(root);
	mkdirSync(join(root, ".claude", "memory"), { recursive: true });
	mkdirSync(join(root, ".github", "workflows"), { recursive: true });
	if (traceLines.length > 0) writeFileSync(join(root, ".claude", "memory", "trace-log.jsonl"), traceLines.join("\n") + "\n");
	writeFileSync(join(root, ".github", "workflows", "ci.yml"), `- run: node x budget context --profile core ${capLine}\n`);
	cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(root);
	return root;
}

beforeEach(() => {
	chunks = [];
	logSpy = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void chunks.push(a.map(String).join(" ")));
	// Sensible all-green defaults; individual tests override.
	vi.mocked(checkHardGates).mockResolvedValue([
		{ name: "g1", status: "pass", detail: "" },
		{ name: "g2", status: "pass", detail: "" },
	]);
	vi.mocked(checkMemoryHealth).mockReturnValue([{ name: "mem", status: "pass", detail: "ok" }]);
	vi.mocked(buildInventory).mockReturnValue({ entries: [{ status: "active" } as never], issues: [] });
	vi.mocked(checkStaleIndex).mockReturnValue([]);
	vi.mocked(computeContextBudget).mockReturnValue({ profile: "core", files: 10, lines: 100, tokens: 50_000 });
	vi.mocked(readInstallMetadata).mockReturnValue({ source: "new", meta: { profile: "core" } as never });
});

afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
	cwdSpy?.mockRestore();
	logSpy?.mockRestore();
	vi.clearAllMocks();
});

const output = (): string => chunks.join("\n");

describe("health", () => {
	it("emits the documented JSON shape with a rollup count", async () => {
		setupRepo([]);
		await health({ json: true });
		const report = JSON.parse(output());
		expect(report).toHaveProperty("profile", "core");
		expect(report).toHaveProperty("rollup");
		expect(Array.isArray(report.panels)).toBe(true);
		const sum = report.rollup.pass + report.rollup.warn + report.rollup.fail + report.rollup.na;
		expect(sum).toBe(report.panels.length);
	});

	it("renders hook failures as a COUNT (0 on empty log), not a rate", async () => {
		setupRepo([]);
		await health({ json: true });
		const panel = JSON.parse(output()).panels.find((p: { panel: string }) => p.panel === "Hook failures");
		expect(panel.status).toBe("pass");
		expect(panel.detail).toMatch(/0 hook failure\(s\)/);
		expect(panel.detail).not.toMatch(/%|rate/i);
	});

	it("warns on hook failures and surfaces repeated failures", async () => {
		setupRepo([
			rec("hook.failed", { hook: "gate-enforcement.sh", shell: "bash", exit_code: 1 }),
			rec("gate.blocked", { gate: "gate1-no-plan" }),
			rec("gate.blocked", { gate: "gate1-no-plan" }),
		]);
		await health({ json: true });
		const panels = JSON.parse(output()).panels;
		expect(panels.find((p: { panel: string }) => p.panel === "Hook failures").status).toBe("warn");
		const repeated = panels.find((p: { panel: string }) => p.panel === "Top repeated failures");
		expect(repeated.status).toBe("warn");
		expect(repeated.detail).toMatch(/gate:gate1-no-plan ×2/);
	});

	it("renders unused-skills as N/A (never a list) and repeated-failures N/A on empty log", async () => {
		setupRepo([]);
		await health({ json: true });
		const panels = JSON.parse(output()).panels;
		const unused = panels.find((p: { panel: string }) => p.panel === "Unused skills/agents");
		expect(unused.status).toBe("na");
		expect(unused.detail).toMatch(/usage events not emitted/);
		expect(panels.find((p: { panel: string }) => p.panel === "Top repeated failures").status).toBe("na");
	});

	it("grades context budget against the CI cap (fail when over)", async () => {
		setupRepo([]);
		vi.mocked(computeContextBudget).mockReturnValue({ profile: "core", files: 99, lines: 9, tokens: 200_000 });
		await health({ json: true });
		const panel = JSON.parse(output()).panels.find((p: { panel: string }) => p.panel === "Context budget");
		expect(panel.status).toBe("fail");
		expect(panel.detail).toMatch(/200000 \/ 130000/);
	});

	it("rolls a FAIL gate into the FAIL count", async () => {
		setupRepo([]);
		vi.mocked(checkHardGates).mockResolvedValue([{ name: "g1", status: "fail", detail: "broken" }]);
		await health({ json: true });
		const report = JSON.parse(output());
		expect(report.rollup.fail).toBeGreaterThanOrEqual(1);
		expect(report.panels.find((p: { panel: string }) => p.panel === "Hard gates").status).toBe("fail");
	});
});
