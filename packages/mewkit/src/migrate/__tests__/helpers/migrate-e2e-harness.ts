// Shared harness for CLI-level migrate tests: isolates HOME (portable registry,
// locks) and the project directory in tmp, copies the fixture corpus in, and
// dynamically imports the orchestrator AFTER the env redirect so module-load
// path resolution picks up the isolated HOME.

import { mkdtempSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MigrateOptions } from "../../types.js";

const fixtureSource = fileURLToPath(new URL("../fixtures/codex-full-surface/.claude", import.meta.url));

export interface MigrateE2eEnv {
	projectDir: string;
	sourceDir: string;
	tempHome: string;
	run(options: Partial<MigrateOptions>): Promise<number>;
	cleanup(): Promise<void>;
}

export async function setupMigrateE2e(prefix: string): Promise<MigrateE2eEnv> {
	const originalHome = process.env.HOME;
	const originalCwd = process.cwd();
	const tempHome = mkdtempSync(join(tmpdir(), `${prefix}-home-`));
	const projectDir = mkdtempSync(join(tmpdir(), `${prefix}-project-`));
	const sourceDir = join(projectDir, ".claude");
	await cp(fixtureSource, sourceDir, { recursive: true });
	await mkdir(join(tempHome, ".mewkit"), { recursive: true });

	process.env.HOME = tempHome;
	process.chdir(projectDir);
	const { runMigrate } = await import("../../migrate-orchestrator.js");

	return {
		projectDir,
		sourceDir,
		tempHome,
		async run(options: Partial<MigrateOptions>): Promise<number> {
			const logSpy = console.log;
			const errSpy = console.error;
			// Keep e2e output quiet; failures surface through exit codes and asserts.
			console.log = () => {};
			console.error = () => {};
			try {
				return await runMigrate(
					{ tool: "codex", yes: true, source: sourceDir, ...options },
					{ bundledKitDir: join(projectDir, "no-bundled-kit"), argv: [] },
				);
			} finally {
				console.log = logSpy;
				console.error = errSpy;
			}
		},
		async cleanup(): Promise<void> {
			process.chdir(originalCwd);
			process.env.HOME = originalHome;
			await rm(tempHome, { recursive: true, force: true });
			await rm(projectDir, { recursive: true, force: true });
		},
	};
}
