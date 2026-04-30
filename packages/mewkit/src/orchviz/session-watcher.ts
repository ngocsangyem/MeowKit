/**
 * SessionWatcher — discover + tail Claude Code session JSONL files.
 *
 * Architecture ported from patoles/agent-flow @ 59ccf4e (extension/src/
 * session-watcher.ts + scripts/relay.ts). License Apache-2.0 (see ../../NOTICE).
 *
 * Emits:
 *   "session:start"  { sessionId, filePath }
 *   "line"           { sessionId, line }     // raw JSONL string
 *   "session:reset"  { sessionId }           // truncation / compaction
 *   "error"          Error
 *   "closed"         (after dispose)
 */

import * as fs from "node:fs";
import { EventEmitter } from "node:events";
import { POLL_FALLBACK_MS, SCAN_INTERVAL_MS } from "./constants.js";
import { findActiveSessions, type SessionFile } from "./session-discovery.js";
import { readNewFileLines } from "./fs-utils.js";

interface AttachedSession {
	sessionId: string;
	filePath: string;
	fileSize: number;
	tail: string;
	watcher: fs.FSWatcher | null;
	pollTimer: NodeJS.Timeout | null;
}

export interface SessionWatcherOptions {
	sessionId?: string;
	verbose?: boolean;
}

export class SessionWatcher extends EventEmitter {
	private readonly workspace: string;
	private readonly opts: SessionWatcherOptions;
	private readonly sessions = new Map<string, AttachedSession>();
	private scanTimer: NodeJS.Timeout | null = null;
	private disposed = false;

	constructor(workspace: string, opts: SessionWatcherOptions = {}) {
		super();
		this.workspace = workspace;
		this.opts = opts;
	}

	start(): void {
		const initial = findActiveSessions(this.workspace);
		if (this.opts.sessionId) {
			const target = initial.find((s) => s.sessionId === this.opts.sessionId);
			if (!target) {
				this.emit("error", new Error(`No active session matches --session ${this.opts.sessionId}`));
				return;
			}
			this.attach(target);
			return;
		}
		for (const file of initial) this.attach(file);

		this.scanTimer = setInterval(() => this.rescan(), SCAN_INTERVAL_MS);
		if (typeof this.scanTimer.unref === "function") this.scanTimer.unref();
	}

	getAttached(): readonly string[] {
		return Array.from(this.sessions.keys());
	}

	private rescan(): void {
		if (this.disposed) return;
		const found = findActiveSessions(this.workspace);
		for (const file of found) {
			if (!this.sessions.has(file.sessionId)) this.attach(file);
		}
	}

	private attach(file: SessionFile): void {
		if (this.disposed || this.sessions.has(file.sessionId)) return;
		const session: AttachedSession = {
			sessionId: file.sessionId,
			filePath: file.filePath,
			fileSize: 0,
			tail: "",
			watcher: null,
			pollTimer: null,
		};
		this.sessions.set(file.sessionId, session);

		try {
			session.watcher = fs.watch(file.filePath, () => this.onChange(session.sessionId));
			session.watcher.on("error", () => {
				// fall back to poll only
				try {
					session.watcher?.close();
				} catch {
					// ignore
				}
				session.watcher = null;
			});
		} catch {
			session.watcher = null;
		}

		session.pollTimer = setInterval(() => this.onChange(session.sessionId), POLL_FALLBACK_MS);
		if (typeof session.pollTimer.unref === "function") session.pollTimer.unref();

		this.emit("session:start", { sessionId: session.sessionId, filePath: session.filePath });
		// Drain pre-existing content so the parser sees the full transcript.
		this.onChange(session.sessionId);
	}

	private onChange(sessionId: string): void {
		const s = this.sessions.get(sessionId);
		if (!s || this.disposed) return;
		const result = readNewFileLines(s.filePath, s.fileSize, s.tail);
		if (!result) return;
		if (result.newSize < s.fileSize || (result.newSize === 0 && s.fileSize > 0)) {
			s.fileSize = 0;
			s.tail = "";
			this.emit("session:reset", { sessionId });
			return;
		}
		s.fileSize = result.newSize;
		s.tail = result.tail;
		for (const line of result.lines) {
			this.emit("line", { sessionId, line });
		}
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		if (this.scanTimer) {
			clearInterval(this.scanTimer);
			this.scanTimer = null;
		}
		for (const s of this.sessions.values()) {
			if (s.pollTimer) clearInterval(s.pollTimer);
			try {
				s.watcher?.close();
			} catch {
				// ignore
			}
		}
		this.sessions.clear();
		this.emit("closed");
	}
}
