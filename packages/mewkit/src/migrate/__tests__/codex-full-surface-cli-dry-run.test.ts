// CLI-level characterization: `migrate --dry-run` over the fixture corpus must
// print a preflight summary and write nothing into the target project.
// HOME is redirected to a temp dir BEFORE importing the orchestrator so the
// portable registry path (resolved at module load) never touches the real user home.

import { existsSync, mkdtempSync } from "node:fs";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const fixtureSource = fileURLToPath(new URL("./fixtures/codex-full-surface/.claude", import.meta.url));

const originalHome = process.env.HOME;
const originalCwd = process.cwd();
let tempHome: string;
let projectDir: string;
let sourceDir: string;
let runMigrate: typeof import("../migrate-orchestrator.js").runMigrate;

beforeAll(async () => {
	tempHome = mkdtempSync(join(tmpdir(), "mewkit-dry-run-home-"));
	projectDir = mkdtempSync(join(tmpdir(), "mewkit-dry-run-project-"));
	sourceDir = join(projectDir, ".claude");
	await cp(fixtureSource, sourceDir, { recursive: true });
	await mkdir(join(tempHome, ".mewkit"), { recursive: true });

	process.env.HOME = tempHome;
	process.chdir(projectDir);
	({ runMigrate } = await import("../migrate-orchestrator.js"));
});

afterAll(async () => {
	process.chdir(originalCwd);
	process.env.HOME = originalHome;
	await rm(tempHome, { recursive: true, force: true });
	await rm(projectDir, { recursive: true, force: true });
});

describe("migrate --dry-run over the fixture corpus (codex)", () => {
	it("prints the preflight report and writes no provider files", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		let exitCode: number;
		let output: string;
		try {
			exitCode = await runMigrate(
				{ tool: "codex", dryRun: true, yes: true, source: sourceDir },
				{ bundledKitDir: join(projectDir, "no-bundled-kit"), argv: [] },
			);
			output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
		} finally {
			logSpy.mockRestore();
		}

		expect(exitCode).toBe(0);
		expect(output).toContain("dry run");

		// Dry run must not write any provider surface into the target project.
		expect(existsSync(join(projectDir, ".codex"))).toBe(false);
		expect(existsSync(join(projectDir, ".agents"))).toBe(false);
		expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false);

		const entries = await readdir(projectDir);
		// The project-scope lock cleans up after itself — no toolkit directory
		// persists in the target project.
		expect(entries.sort()).toEqual([".claude"]);
	});
});
