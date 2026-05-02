/**
 * TranscriptParser — orchestrates JSONL → AgentEvent dispatch.
 *
 * Ported from patoles/agent-flow @ 59ccf4e (transcript-parser.ts).
 * License Apache-2.0 (see ../../../NOTICE).
 *
 * This module is the SOLE WRITER of:
 *   - session.spawnedSubagents       (per red-team finding High #9)
 *   - session.inlineProgressAgents   (Phase 4 file watcher is read-only)
 */

import type {
	AgentEvent,
	PendingToolCall,
	ToolResultBlock,
	ToolUseBlock,
	TranscriptEntry,
	WatchedSession,
} from "../protocol.js";
import { HASH_PREFIX_MAX, MESSAGE_MAX, ORCHESTRATOR_NAME } from "../constants.js";
import { createLogger } from "../logger.js";
import { estimateTokensFromText } from "../token-estimator.js";
import { handleTextBlock } from "./handle-text.js";
import { handleThinkingBlock } from "./handle-thinking.js";
import { handleToolUse } from "./handle-tool-use.js";
import { handleToolResult } from "./handle-tool-result.js";
import { handleProgressEvent } from "./handle-progress.js";
import { handleSystemEntry } from "./handle-system.js";
import { evictOldEntries, isSystemInjectedContent } from "./utils.js";
import { applySessionLabel } from "./label-helpers.js";

const log = createLogger("TranscriptParser");

export interface TranscriptParserDelegate {
	emit(event: AgentEvent, sessionId?: string): void;
	elapsed(sessionId?: string): number;
	getSession(sessionId: string): WatchedSession | undefined;
	fireSessionLifecycle(event: {
		type: "started" | "ended" | "updated";
		sessionId: string;
		label: string;
	}): void;
	emitContextUpdate(agentName: string, session: WatchedSession, sessionId?: string): void;
}

export interface InlineSubagentState {
	agentName: string;
	pending: Map<string, PendingToolCall>;
	seen: Set<string>;
	seenMessages: Set<string>;
}

export class TranscriptParser {
	readonly inlineSubagentState = new Map<string, InlineSubagentState>();
	readonly subagentChildNames = new Map<string, string>();

	constructor(public readonly delegate: TranscriptParserDelegate) {}

	clearSessionState(pendingToolUseIds: Iterable<string>): void {
		for (const id of pendingToolUseIds) {
			this.inlineSubagentState.delete(id);
			this.subagentChildNames.delete(id);
		}
	}

	processTranscriptLine(
		line: string,
		agentName: string = ORCHESTRATOR_NAME,
		ctxPending: Map<string, PendingToolCall>,
		ctxSeen: Set<string>,
		sessionId?: string,
		ctxSeenMessages?: Set<string>,
	): void {
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(line.trim()) as Record<string, unknown>;
		} catch (err) {
			log.debug("Skipping unparseable line:", err);
			return;
		}

		if (parsed.type === "progress") {
			handleProgressEvent(this, parsed, sessionId);
			return;
		}
		// [CRITICAL — red-team #5] Dispatch system entries BEFORE the early-return guard.
		// Without this, handle-system.ts is unreachable — "system" lines are dropped silently.
		if (parsed.type === "system") {
			handleSystemEntry(this, parsed, sessionId, agentName);
			return;
		}
		if (parsed.type !== "user" && parsed.type !== "assistant") return;

		// Filter sidechain (branched) turns — research-02 §7
		if (parsed.isSidechain === true) return;

		const msg = parsed.message as TranscriptEntry["message"] | undefined;
		if (!msg) return;

		const entry: TranscriptEntry = {
			sessionId: parsed.sessionId as string,
			type: parsed.type as string,
			uuid: parsed.uuid as string | undefined,
			message: msg,
		};

		if (sessionId) this.maybeSetSessionLabel(entry, sessionId);

		const role = msg.role;
		const session = sessionId ? this.delegate.getSession(sessionId) : undefined;

		if (session && !session.model && entry.type === "assistant" && msg.model) {
			session.model = msg.model;
			this.delegate.emit(
				{
					time: this.delegate.elapsed(sessionId),
					type: "model_detected",
					payload: { agent: agentName, model: msg.model },
				},
				sessionId,
			);
		}

		const seenMsgs = ctxSeenMessages ?? session?.seenMessageHashes;

		if (typeof msg.content === "string" && msg.content.trim()) {
			if (role === "user" || role === "human") {
				const text = msg.content.trim();
				if (!isSystemInjectedContent(text)) {
					const hash = entry.uuid
						? `user:${entry.uuid}`
						: `user:${text.slice(0, HASH_PREFIX_MAX)}`;
					if (!seenMsgs?.has(hash)) {
						if (seenMsgs) {
							seenMsgs.add(hash);
							evictOldEntries(seenMsgs);
						}
						if (session) session.contextBreakdown.userMessages += estimateTokensFromText(text);
						this.delegate.emit(
							{
								time: this.delegate.elapsed(sessionId),
								type: "message",
								payload: {
									agent: agentName,
									role: "user",
									content: text.slice(0, MESSAGE_MAX),
								},
							},
							sessionId,
						);
					}
				}
			}
			if (session) this.delegate.emitContextUpdate(agentName, session, sessionId);
			return;
		}

		if (!Array.isArray(msg.content)) return;

		const emitRole = role === "user" || role === "human" ? "user" : "assistant";

		for (const block of msg.content) {
			if (block.type === "tool_use") {
				const toolBlock = block as ToolUseBlock;
				if (ctxSeen.has(toolBlock.id)) continue;
				ctxSeen.add(toolBlock.id);
				evictOldEntries(ctxSeen);
				handleToolUse(this, toolBlock, agentName, ctxPending, sessionId);
			} else if (block.type === "tool_result") {
				handleToolResult(this, block as ToolResultBlock, agentName, ctxPending, sessionId);
			} else if (block.type === "text" && "text" in block) {
				handleTextBlock(this, block, emitRole, entry.uuid, agentName, seenMsgs, session, sessionId);
			} else if (block.type === "thinking" && "thinking" in block) {
				handleThinkingBlock(this, block, entry.uuid, agentName, seenMsgs, session, sessionId);
			}
		}

		if (session) this.delegate.emitContextUpdate(agentName, session, sessionId);
	}

	private maybeSetSessionLabel(entry: TranscriptEntry, sessionId: string): void {
		const session = this.delegate.getSession(sessionId);
		if (!session) return;
		if (applySessionLabel(session, entry)) {
			this.delegate.fireSessionLifecycle({ type: "updated", sessionId, label: session.label });
		}
	}
}
