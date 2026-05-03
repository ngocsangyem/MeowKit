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
	| "permission_requested" // KEEP — backwards compat alias of pause_started reason=permission_request
	| "pause_started" // NEW
	| "pause_cleared" // NEW
	| "error";

// ─── Pause Event Types ───────────────────────────────────────────────────────

/**
 * Deterministic pause reasons emitted by the parser layer.
 * - permission_request: heuristic 5s stall fallback (no toolUseId)
 * - ask_user_question: AskUserQuestion tool_use with no matching tool_result
 * - plan_mode_review: ExitPlanMode tool_use with no matching tool_result
 * - tool_rejected: tool_result content contains rejection string
 * - hook_blocked: system stop_hook_summary with preventedContinuation=true
 */
export type PauseReason =
	| "permission_request"
	| "ask_user_question"
	| "plan_mode_review"
	| "tool_rejected"
	| "hook_blocked";

/**
 * Detail payload for pause_started events.
 * All string fields must flow through sanitize.ts before SSE emission (enforced in phase-06).
 *
 * [red-team #22] options is string[] (flat), NOT Array<{label; description?}>.
 * Aligns with what tool-input-data.ts:67-69 already produces.
 *
 * [red-team #16] detail.plan is emitted with newlines preserved; phase-04 renders
 * via JSX .map() — NEVER use dangerouslySetInnerHTML to restore newlines.
 *
 * [security — red-team #17] hookCommand may contain env-style secrets
 * (AWS_SECRET_ACCESS_KEY=, Authorization: Bearer). Known gap for v1 — documented,
 * mitigation deferred to follow-up CLI warning. See phase-02 security notes.
 */
export interface PauseDetail {
	questions?: Array<{
		question: string;
		header?: string;
		options: string[]; // flat string[] — matches tool-input-data.ts shape
		multiSelect?: boolean;
	}>;
	plan?: string; // truncated to PLAN_PREVIEW_MAX (2KB) server-side
	hookCommand?: string;
	hookReason?: string;
}

export interface PauseStartedPayload {
	agent: string;
	reason: PauseReason;
	toolUseId?: string; // omitted for permission_request heuristic (red-team #18)
	toolName?: string;
	detail?: PauseDetail;
}

export interface PauseClearedPayload {
	agent: string;
	reason: PauseReason;
	toolUseId?: string;
	durationMs: number;
}

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
	/** Originating Task/Agent tool_use id from the spawn sidecar, when available. */
	spawnToolUseId?: string;
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
	/**
	 * Dedup primary key for agent_spawn events. Keyed by originating tool_use id
	 * so siblings sharing a display label (two `subagent_type: "researcher"` calls)
	 * each fire their own spawn — the canvas reactivates the existing node.
	 */
	spawnedToolUseIds: Set<string>;
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
