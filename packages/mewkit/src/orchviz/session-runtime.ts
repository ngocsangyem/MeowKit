/**
 * SessionRuntime — wires SessionWatcher + TranscriptParser + SessionManager
 * + SubagentScanner. Exposes a single AgentEvent stream for downstream consumers.
 */

import * as path from "node:path";
import { EventEmitter } from "node:events";
import type { AgentEvent, WatchedSession } from "./protocol.js";
import { SessionWatcher, type SessionWatcherOptions } from "./session-watcher.js";
import { SessionManager } from "./session-manager.js";
import { TranscriptParser, type TranscriptParserDelegate } from "./parser/index.js";
import { ORCHESTRATOR_NAME, INACTIVITY_TIMEOUT_MS } from "./constants.js";
import type { SubagentWatcherDelegate } from "./subagent-watcher.js";
import { SubagentScanner } from "./subagent-scanner.js";

export interface SessionRuntimeOptions extends SessionWatcherOptions {}

export class SessionRuntime extends EventEmitter {
	readonly manager = new SessionManager();
	readonly watcher: SessionWatcher;
	readonly parser: TranscriptParser;
	private readonly scanner: SubagentScanner;
	private disposed = false;

	constructor(workspace: string, opts: SessionRuntimeOptions = {}) {
		super();
		this.watcher = new SessionWatcher(workspace, opts);

		const emit = (ev: AgentEvent, sid?: string): void => {
			const event = sid ? { ...ev, sessionId: sid } : ev;
			this.emit("event", event);
		};
		const elapsed = (sid?: string): number => {
			if (sid) {
				const s = this.manager.get(sid);
				if (s) return Date.now() - s.sessionStartTime;
			}
			return this.manager.elapsed();
		};

		const parserDelegate: TranscriptParserDelegate = {
			emit,
			elapsed,
			getSession: (sid: string) => this.manager.get(sid),
			fireSessionLifecycle: (lifecycle) => this.emit("lifecycle", lifecycle),
			emitContextUpdate: (agentName: string, session: WatchedSession, sid?: string) => {
				emit(
					{
						time: Date.now() - session.sessionStartTime,
						type: "context_update",
						payload: { agent: agentName, breakdown: { ...session.contextBreakdown } },
					},
					sid,
				);
			},
		};
		this.parser = new TranscriptParser(parserDelegate);

		const subagentDelegate: SubagentWatcherDelegate = {
			emit,
			elapsed,
			getLastActivityTime: (sid: string) => this.manager.get(sid)?.lastActivityTime,
			getSession: (sid: string) => this.manager.get(sid),
			resetInactivityTimer: (sid: string) => this.armInactivity(sid),
		};
		this.scanner = new SubagentScanner(subagentDelegate, this.parser);

		this.watcher.on(
			"session:start",
			({ sessionId, filePath }: { sessionId: string; filePath: string }) => {
				const session = this.manager.create(sessionId, filePath);
				const projectDir = path.dirname(filePath);
				session.subagentsDir = path.join(projectDir, sessionId, "subagents");
				this.armInactivity(sessionId);
				// Spawn the main orchestrator node so the canvas has a root agent for
				// every subsequent tool/message event to attach to. Without this, no
				// nodes ever render — subagents only spawn on Task/Agent tool calls.
				emit(
					{
						time: 0,
						type: "agent_spawn",
						payload: {
							name: ORCHESTRATOR_NAME,
							parent: null,
							task: session.label,
							isMain: true,
						},
					},
					sessionId,
				);
				this.scanner.start(sessionId);
				this.emit("session:start", { sessionId, filePath, label: session.label });
			},
		);
		this.watcher.on("session:reset", ({ sessionId }: { sessionId: string }) => {
			this.emit("session:reset", { sessionId });
		});
		this.watcher.on("line", ({ sessionId, line }: { sessionId: string; line: string }) => {
			const session = this.manager.get(sessionId);
			if (!session) return;
			session.lastActivityTime = Date.now();
			this.parser.processTranscriptLine(
				line,
				ORCHESTRATOR_NAME,
				session.pendingToolCalls,
				session.seenToolUseIds,
				sessionId,
				session.seenMessageHashes,
			);
		});
		this.watcher.on("error", (err: Error) => this.emit("error", err));
		this.watcher.on("closed", () => this.emit("closed"));
	}

	private armInactivity(sessionId: string): void {
		const session = this.manager.get(sessionId);
		if (!session) return;
		if (session.inactivityTimer) clearTimeout(session.inactivityTimer);
		session.inactivityTimer = setTimeout(() => {
			session.sessionCompleted = true;
			this.emit("session:end", { sessionId });
		}, INACTIVITY_TIMEOUT_MS);
		if (typeof session.inactivityTimer.unref === "function") session.inactivityTimer.unref();
	}

	start(): void {
		this.watcher.start();
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.scanner.stop();
		for (const s of this.manager.list()) {
			if (s.inactivityTimer) clearTimeout(s.inactivityTimer);
			if (s.permissionTimer) clearTimeout(s.permissionTimer);
			for (const sa of s.subagentWatchers.values()) {
				if (sa.permissionTimer) clearTimeout(sa.permissionTimer);
				try {
					sa.watcher?.close();
				} catch {
					// ignore
				}
			}
			try {
				s.subagentsDirWatcher?.close();
			} catch {
				// ignore
			}
		}
		this.watcher.dispose();
	}
}
