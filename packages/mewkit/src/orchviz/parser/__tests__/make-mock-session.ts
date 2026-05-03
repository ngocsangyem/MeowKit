/**
 * Factory for a fully-populated WatchedSession suitable for parser tests.
 *
 * Tests that exercise dedup paths need real Set/Map instances, not undefined
 * stubs. FSWatcher / NodeJS.Timeout fields are null because they are not
 * exercised by parser unit tests.
 */

import type { WatchedSession } from "../../protocol.js";

export function makeMockSession(overrides: Partial<WatchedSession> = {}): WatchedSession {
	return {
		sessionId: "sess-test",
		filePath: "/tmp/test.jsonl",
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
		spawnedToolUseIds: new Set(),
		inlineProgressAgents: new Set(),
		subagentsDirWatcher: null,
		subagentsDir: null,
		label: "test",
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
		...overrides,
	};
}
