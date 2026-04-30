/**
 * Agent event protocol — types describing live Claude Code session events.
 *
 * Ported (in part) from patoles/agent-flow @ 59ccf4e
 *   Original: extension/src/protocol.ts
 *   License:  Apache-2.0 (see ../../NOTICE)
 *
 * Modifications: dropped VS Code extension/webview message types;
 * replaced FSWatcher import path; pruned helper signatures unused server-side.
 */

import type { FSWatcher } from "node:fs";

export type AgentEventType =
	| "agent_spawn"
	| "agent_complete"
	| "agent_idle"
	| "message"
	| "context_update"
	| "model_detected"
	| "tool_call_start"
	| "tool_call_end"
	| "subagent_dispatch"
	| "subagent_return"
	| "permission_requested"
	| "error";

export interface AgentEvent {
	time: number;
	type: AgentEventType;
	payload: Record<string, unknown>;
	sessionId?: string;
}

export interface SessionInfo {
	id: string;
	label: string;
	status: "active" | "completed";
	startTime: number;
	lastActivityTime: number;
}

// ─── Transcript Types (from Claude Code JSONL files) ────────────────────────

export interface TranscriptEntry {
	sessionId: string;
	type: string;
	uuid?: string;
	message: {
		role: string;
		model?: string;
		content: Array<TranscriptContentBlock> | string;
	};
}

export interface ToolUseBlock {
	type: "tool_use";
	name: string;
	id: string;
	input: Record<string, unknown>;
}

export interface ToolResultBlock {
	type: "tool_result";
	tool_use_id: string;
	content: string | Array<{ text?: string; type?: string }>;
}

export interface ThinkingBlock {
	type: "thinking";
	thinking: string;
}

export interface TextBlock {
	type: "text";
	text: string;
}

export type TranscriptContentBlock =
	| ToolUseBlock
	| ToolResultBlock
	| ThinkingBlock
	| TextBlock
	| { type: string; [key: string]: unknown };

// ─── Shared Helpers ─────────────────────────────────────────────────────────

export interface AgentEventEmitter {
	emit(event: AgentEvent, sessionId?: string): void;
	elapsed(sessionId?: string): number;
}

export function emitSubagentSpawn(
	emitter: AgentEventEmitter,
	parent: string,
	child: string,
	task: string,
	sessionId?: string,
): void {
	emitter.emit(
		{
			time: emitter.elapsed(sessionId),
			type: "subagent_dispatch",
			payload: { parent, child, task },
		},
		sessionId,
	);
	emitter.emit(
		{
			time: emitter.elapsed(sessionId),
			type: "agent_spawn",
			payload: { name: child, parent, task },
		},
		sessionId,
	);
}

// ─── Internal State Types ───────────────────────────────────────────────────

export interface PendingToolCall {
	name: string;
	args: string;
	filePath?: string;
	startTime: number;
}

export interface SubagentState {
	watcher: FSWatcher | null;
	fileSize: number;
	agentName: string;
	pendingToolCalls: Map<string, PendingToolCall>;
	seenToolUseIds: Set<string>;
	permissionTimer: NodeJS.Timeout | null;
	permissionEmitted: boolean;
	spawnEmitted: boolean;
}

export interface ContextBreakdown {
	systemPrompt: number;
	userMessages: number;
	toolResults: number;
	reasoning: number;
	subagentResults: number;
}

export interface WatchedSession {
	sessionId: string;
	filePath: string;
	fileWatcher: FSWatcher | null;
	pollTimer: NodeJS.Timeout | null;
	fileSize: number;
	sessionStartTime: number;
	pendingToolCalls: Map<string, PendingToolCall>;
	seenToolUseIds: Set<string>;
	seenMessageHashes: Set<string>;
	sessionDetected: boolean;
	sessionCompleted: boolean;
	lastActivityTime: number;
	inactivityTimer: NodeJS.Timeout | null;
	subagentWatchers: Map<string, SubagentState>;
	spawnedSubagents: Set<string>;
	inlineProgressAgents: Set<string>;
	subagentsDirWatcher: FSWatcher | null;
	subagentsDir: string | null;
	label: string;
	labelSet: boolean;
	model: string | null;
	permissionTimer: NodeJS.Timeout | null;
	permissionEmitted: boolean;
	contextBreakdown: ContextBreakdown;
}
