// Partial-failure robustness: when a converter/installer throws mid-run, the
// migration report MUST still be written (write-what-happened) AND the ORIGINAL
// exception must propagate — a failed run is never masked, and a failed report
// write never masks the run. Here we force the codex agents installer to throw.

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const INSTALLER_BOOM = "forced installer failure (test)";

// Mock the hooks barrel so the codex agents installer throws, but keep every other
// export real (mergeHooksSettings, path-safety helpers, …).
vi.mock("../hooks/index.js", async () => {
	const actual = await vi.importActual<typeof import("../hooks/index.js")>("../hooks/index.js");
	return {
		...actual,
		installCodexAgents: vi.fn(async () => {
			throw new Error(INSTALLER_BOOM);
		}),
	};
});

const fixtureSource = fileURLToPath(new URL("./fixtures/codex-full-surface/.claude", import.meta.url));

let projectDir: string;
let sourceDir: string;
let tempHome: string;
let originalHome: string | undefined;
let originalCwd: string;
let thrown: unknown;

beforeAll(async () => {
	originalHome = process.env.HOME;
	originalCwd = process.cwd();
	tempHome = mkdtempSync(join(tmpdir(), "report-partial-home-"));
	projectDir = mkdtempSync(join(tmpdir(), "report-partial-project-"));
	sourceDir = join(projectDir, ".claude");
	await cp(fixtureSource, sourceDir, { recursive: true });
	await mkdir(join(tempHome, ".mewkit"), { recursive: true });

	process.env.HOME = tempHome;
	process.chdir(projectDir);

	const { runMigrate } = await import("../migrate-orchestrator.js");
	const logSpy = console.log;
	const errSpy = console.error;
	console.log = () => {};
	console.error = () => {};
	try {
		await runMigrate(
			{ tool: "codex", yes: true, source: sourceDir },
			{ bundledKitDir: join(projectDir, "no-bundled-kit"), argv: [] },
		);
	} catch (err) {
		thrown = err;
	} finally {
		console.log = logSpy;
		console.error = errSpy;
	}
}, 60_000);

afterAll(async () => {
	process.chdir(originalCwd);
	process.env.HOME = originalHome;
	vi.restoreAllMocks();
	await rm(tempHome, { recursive: true, force: true });
	await rm(projectDir, { recursive: true, force: true });
});

describe("migration report is written on partial failure and re-throws the original", () => {
	it("re-throws the original installer exception (never masked by the report write)", () => {
		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).message).toContain(INSTALLER_BOOM);
	});

	it("still persists the migration report (write-what-happened)", () => {
		expect(existsSync(join(projectDir, ".codex", "migration-report.json"))).toBe(true);
		const report = JSON.parse(readFileSync(join(projectDir, ".codex", "migration-report.json"), "utf-8")) as {
			artifacts: Array<{ type: string; sourcePath: string; status: string }>;
			header: { counts: { total: number } };
		};
		// The report exists and its identity denominator is populated even though the
		// run aborted mid-install.
		expect(report.header.counts.total).toBeGreaterThan(0);
	});
});
