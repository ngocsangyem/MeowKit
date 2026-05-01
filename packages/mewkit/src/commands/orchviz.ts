import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { SessionRuntime } from "../orchviz/session-runtime.js";
import { OrchvizServer } from "../orchviz/server/index.js";
import { makeOverlayProvider, makePlanCollector } from "../orchviz/server/api-handlers.js";
import { LogPersister, sanitizeSessionIdForPath } from "../orchviz/log-persister.js";
import { openURL } from "../orchviz/open-url.js";
import { setVerbose } from "../orchviz/logger.js";
import type { AgentEvent } from "../orchviz/protocol.js";

export interface OrchvizArgs {
	port?: number;
	open?: boolean;
	noOpen?: boolean;
	session?: string;
	workspace?: string;
	noColor?: boolean;
	verbose?: boolean;
	log?: string | boolean;
}

function findProjectRoot(start: string): string | null {
	let cur = path.resolve(start);
	while (true) {
		if (
			fs.existsSync(path.join(cur, ".claude")) ||
			fs.existsSync(path.join(cur, "CLAUDE.md"))
		) {
			return cur;
		}
		const parent = path.dirname(cur);
		if (parent === cur) return null;
		cur = parent;
	}
}

function resolveStaticDir(): string {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const candidate = path.resolve(here, "..", "..", "dist", "orchviz-web");
	return candidate;
}

function resolveLogPath(
	logArg: string | boolean | undefined,
	projectRoot: string | null,
	sessionId: string | null,
): string | null {
	if (logArg === undefined || logArg === false) return null;
	if (typeof logArg === "string" && logArg.length > 0) {
		const abs = path.resolve(logArg);
		if (!abs.endsWith(".md")) {
			console.error(pc.red(`--log path must end in .md (got ${abs})`));
			process.exit(2);
		}
		const cwd = process.cwd();
		const home = os.homedir();
		const inCwd = abs.startsWith(cwd + path.sep);
		const inHome = abs.startsWith(path.join(home, ".claude") + path.sep);
		if (!inCwd && !inHome) {
			console.error(
				pc.yellow(
					`Warning: --log path ${abs} is outside cwd and ~/.claude/. Writing anyway.`,
				),
			);
		}
		return abs;
	}
	const root = projectRoot ?? process.cwd();
	const slug = sanitizeSessionIdForPath(sessionId ?? "session");
	return path.join(root, ".claude", "logs", `orchviz-${slug}.md`);
}

export async function orchviz(args: OrchvizArgs): Promise<void> {
	const verbose = args.verbose === true;
	if (verbose) setVerbose(true);
	const workspace = path.resolve(args.workspace ?? process.cwd());
	if (!fs.existsSync(workspace)) {
		console.error(pc.red(`--workspace path does not exist: ${workspace}`));
		process.exit(2);
	}
	const projectRoot = findProjectRoot(workspace);

	// Eagerly validate explicit --log <path> (default path resolves later per session).
	if (typeof args.log === "string" && args.log.length > 0) {
		resolveLogPath(args.log, projectRoot, null);
	}

	console.log(`${pc.bold(pc.cyan("meowkit orchviz"))} — watching ${pc.dim(workspace)}`);
	if (!projectRoot) {
		console.log(pc.dim("  (no .claude/ found — overlays will be empty)"));
	}

	const runtime = new SessionRuntime(workspace, { sessionId: args.session, verbose });
	const staticDir = resolveStaticDir();
	const overlayProvider = projectRoot ? makeOverlayProvider(projectRoot) : undefined;
	// Shared PlanCollector — write handler calls invalidate() after writes
	// so the next GET returns fresh data (R2-4 / M4 injection path).
	const planCollector = projectRoot ? makePlanCollector(projectRoot) : undefined;
	const planProvider = projectRoot
		? (slug?: string) => planCollector!.snapshot(slug)
		: undefined;
	const server = new OrchvizServer({
		port: args.port,
		staticDir,
		eventSource: runtime,
		overlayProvider,
		planProvider,
		planCollector,
		projectRoot: projectRoot ?? undefined,
		verbose,
	});

	let logPersister: LogPersister | null = null;
	let firstSessionId: string | null = null;
	let exitCode = 0;
	let eventCount = 0;

	runtime.on("session:start", ({ sessionId, label }: { sessionId: string; label: string }) => {
		if (firstSessionId === null) {
			firstSessionId = sessionId;
			const logPath = resolveLogPath(args.log, projectRoot, sessionId);
			if (logPath) {
				try {
					logPersister = new LogPersister(logPath);
					console.log(pc.dim(`  log: ${logPath}`));
				} catch (err) {
					console.error(pc.red(`Failed to open log: ${(err as Error).message}`));
				}
			}
		}
		console.log(pc.green(`[discovered] ${sessionId.slice(0, 8)} ${pc.dim(`"${label}"`)}`));
	});
	runtime.on("session:reset", ({ sessionId }: { sessionId: string }) => {
		console.log(pc.yellow(`[reset] ${sessionId.slice(0, 8)} (compaction)`));
	});
	runtime.on("event", (event: AgentEvent) => {
		eventCount++;
		logPersister?.append(event);
	});
	runtime.on("error", (err: Error) => {
		console.error(pc.red(err.message));
		exitCode = 1;
	});

	const teardown = async (): Promise<void> => {
		try {
			if (logPersister) await logPersister.close();
		} catch {
			// best-effort
		}
		await server.stop();
		runtime.dispose();
	};

	// Subscribe before runtime.start() — EventEmitter does not queue events.
	const url = await server.start();
	runtime.start();

	if (exitCode !== 0) {
		await teardown();
		process.exit(exitCode);
	}
	console.log(`${pc.bold("Server:")} ${pc.cyan(url)}`);
	if (!fs.existsSync(path.join(staticDir, "index.html"))) {
		console.log(
			pc.yellow(
				`Note: web UI bundle not found at ${staticDir} — run \`npm run build:web\` to produce it.`,
			),
		);
	}

	const wantOpen = args.noOpen ? false : args.open !== false;
	if (wantOpen) {
		openURL(url, (err) => {
			console.error(
				pc.yellow(
					`Could not auto-open browser (${err.message}). Navigate manually to ${url}`,
				),
			);
		});
	}

	if (runtime.watcher.getAttached().length === 0 && !args.session) {
		console.log(pc.dim("No active sessions yet — waiting…"));
	}

	const shutdown = async (): Promise<void> => {
		await teardown();
		console.log(pc.dim(`\norchviz: ${eventCount} events processed.`));
		process.exit(0);
	};
	process.on("SIGINT", () => void shutdown());
	process.on("SIGTERM", () => void shutdown());
	process.on("SIGHUP", () => void shutdown());
}
