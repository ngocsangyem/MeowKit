/**
 * In-memory registry of WatchedSession state, used by parser delegate.
 *
 * Pure data. No fs/io concerns; that's the SessionWatcher's job.
 */

import type { WatchedSession } from "./protocol.js";

export class SessionManager {
	private readonly sessions = new Map<string, WatchedSession>();
	private readonly startWallClock = Date.now();

	create(sessionId: string, filePath: string): WatchedSession {
		const existing = this.sessions.get(sessionId);
		if (existing) return existing;
		const session: WatchedSession = {
			sessionId,
			filePath,
			fileWatcher: null,
			pollTimer: null,
			fileSize: 0,
			sessionStartTime: Date.now(),
			pendingToolCalls: new Map(),
			seenToolUseIds: new Set(),
			seenMessageHashes: new Set(),
			sessionDetected: true,
			sessionCompleted: false,
			lastActivityTime: Date.now(),
			inactivityTimer: null,
			subagentWatchers: new Map(),
			spawnedSubagents: new Set(),
			inlineProgressAgents: new Set(),
			subagentsDirWatcher: null,
			subagentsDir: null,
			label: sessionId.slice(0, 8),
			labelSet: false,
			model: null,
			permissionTimer: null,
			permissionEmitted: false,
			contextBreakdown: {
				systemPrompt: 0,
				userMessages: 0,
				toolResults: 0,
				reasoning: 0,
				subagentResults: 0,
			},
		};
		this.sessions.set(sessionId, session);
		return session;
	}

	get(sessionId: string): WatchedSession | undefined {
		return this.sessions.get(sessionId);
	}

	delete(sessionId: string): void {
		this.sessions.delete(sessionId);
	}

	list(): WatchedSession[] {
		return Array.from(this.sessions.values());
	}

	/** Elapsed ms since the manager was constructed. Used as event.time fallback. */
	elapsed(): number {
		return Date.now() - this.startWallClock;
	}
}
