/**
 * test-server-boot — shared helper for integration and security smoke tests.
 *
 * bootTestServer({ fixturesDir }) copies fixturesDir contents into a mkdtemp
 * workspace under tasks/plans/, starts a real OrchvizServer on port 0
 * (ephemeral), and returns { server, port, projectRoot, cleanup }.
 *
 * CRITICAL: calls resetPlansDirCache() from write-utils.ts before starting so
 * the per-process plansDir realpath cache does not leak across temp dirs.
 *
 * NOTE: This module is for test use only and is excluded from the dist build
 * via tsconfig.json `exclude`. Do NOT import from production code paths.
 */

import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { OrchvizServer } from "./server/index.js";
import { PlanCollector } from "./plan/collector.js";
import { resetPlansDirCache } from "./server/write-utils.js";

export interface TestServerHandle {
	server: OrchvizServer;
	port: number;
	projectRoot: string;
	cleanup: () => Promise<void>;
}

export interface BootOptions {
	/** Directory whose contents (plan slug subdirs) are copied into tasks/plans/ */
	fixturesDir: string;
}

function copyDirSync(src: string, dest: string): void {
	fs.mkdirSync(dest, { recursive: true });
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDirSync(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

export async function bootTestServer(opts: BootOptions): Promise<TestServerHandle> {
	resetPlansDirCache();

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchviz-"));
	const plansDir = path.join(tempDir, "tasks", "plans");
	fs.mkdirSync(plansDir, { recursive: true });

	if (fs.existsSync(opts.fixturesDir)) {
		copyDirSync(opts.fixturesDir, plansDir);
	}

	const planCollector = new PlanCollector(tempDir);
	const planProvider = (slug?: string) => planCollector.snapshot(slug);
	const ev = new EventEmitter();
	const server = new OrchvizServer({
		staticDir: os.tmpdir(),
		eventSource: ev,
		projectRoot: tempDir,
		planCollector,
		planProvider,
	});

	const url = await server.start();
	const urlObj = new URL(url);
	const port = Number(urlObj.port);

	const cleanup = async (): Promise<void> => {
		await server.stop();
		resetPlansDirCache();
		fs.rmSync(tempDir, { recursive: true, force: true });
	};

	return { server, port, projectRoot: tempDir, cleanup };
}
