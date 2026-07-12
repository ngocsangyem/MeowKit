/**
 * `mewkit visual-plan edit|view <plan-dir>` — serve the compiled studio bundle
 * over a transient 127.0.0.1 process and open the browser.
 *
 * `edit` acquires the single-editor lock (Phase 4a is still read-only; the lock
 * exists so Phase 5's write mode is race-safe from day one). `view` never locks.
 * The process serves until SIGINT/SIGTERM, then stops the server and releases the
 * lock. No filesystem writes happen from the browser — the server is the only
 * writer, and in 4a it only reads.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { resolvePlanDir, PlanPathError, artifactExists } from "../infrastructure/visual-plan-repository.js";
import { VisualPlanServer } from "../server/visual-plan-server.js";
import { acquireEditLock, releaseEditLock } from "../server/edit-lock.js";
import { openBrowser } from "../../local-web/open-browser.js";

export interface StudioArgs {
	mode: "edit" | "view";
	planDir?: string;
	open?: boolean;
	noOpen?: boolean;
	force?: boolean;
	port?: number;
}

/** Absolute path to the compiled studio bundle (shipped under dist/). */
function resolveBundleDir(): string {
	const here = dirname(fileURLToPath(import.meta.url));
	return path.resolve(here, "..", "..", "..", "dist", "visual-plan-web");
}

export async function runStudio(args: StudioArgs): Promise<void> {
	if (!args.planDir) {
		console.error(pc.red(`visual-plan ${args.mode}: missing <plan-dir>`));
		process.exitCode = 2;
		return;
	}
	let planDir: string;
	try {
		planDir = resolvePlanDir(args.planDir);
	} catch (e) {
		console.error(pc.red(e instanceof PlanPathError ? e.message : String(e)));
		process.exitCode = 2;
		return;
	}
	if (!artifactExists(planDir)) {
		console.error(pc.red(`No visual artifact at ${path.join(planDir, "visual-plan", "plan.json")}. Generate one via mk:plan-creator first.`));
		process.exitCode = 2;
		return;
	}

	const server = new VisualPlanServer({ planDir, bundleDir: resolveBundleDir(), port: args.port });
	// Bind first so the lock records the real port.
	const url = await server.start();

	if (args.mode === "edit") {
		const lock = acquireEditLock(planDir, server.port, args.force === true);
		if (!lock.ok) {
			await server.stop();
			console.error(pc.red(`Another edit session holds this plan (pid ${lock.heldBy?.pid}, port ${lock.heldBy?.port}). Use --force to override.`));
			process.exitCode = 1;
			return;
		}
	}

	console.log(`${pc.bold(pc.cyan(`mewkit visual-plan ${args.mode}`))} — ${pc.cyan(url)}`);
	if (!fs.existsSync(path.join(resolveBundleDir(), "index.html"))) {
		console.log(pc.yellow(`Note: studio bundle not found — run \`npm run build:web:visual-plan\`.`));
	}
	if (!args.noOpen && args.open !== false) {
		openBrowser(url, (err) => console.error(pc.yellow(`Could not open browser (${err.message}). Navigate to ${url}`)));
	}

	const shutdown = async (): Promise<void> => {
		await server.stop();
		if (args.mode === "edit") releaseEditLock(planDir);
		process.exit(0);
	};
	process.on("SIGINT", () => void shutdown());
	process.on("SIGTERM", () => void shutdown());
	process.on("SIGHUP", () => void shutdown());
}
