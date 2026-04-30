/**
 * Subagent JSONL file discovery + tailing.
 *
 * Ported from patoles/agent-flow @ 59ccf4e (extension/src/subagent-watcher.ts).
 * License Apache-2.0 (see ../NOTICE).
 *
 * Phase 4 is READ-ONLY on `session.inlineProgressAgents` and
 * `session.spawnedSubagents` (per red-team Finding #9). Phase 3 owns writes.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { emitSubagentSpawn } from "./protocol.js";
import type { SubagentState, ToolUseBlock, ToolResultBlock } from "./protocol.js";
import { ORCHESTRATOR_NAME, POLL_FALLBACK_MS } from "./constants.js";
import { readNewFileLines } from "./fs-utils.js";
import { TranscriptParser } from "./parser/index.js";
import {
	handlePermissionDetection,
	type PermissionDetectionDelegate,
} from "./permission-detection.js";
import { resolveNameFromMeta } from "./subagent-meta.js";
import { createLogger } from "./logger.js";
import type { WatchedSession } from "./protocol.js";

const log = createLogger("SubagentWatcher");

export interface SubagentWatcherDelegate extends PermissionDetectionDelegate {
	getSession(sessionId: string): WatchedSession | undefined;
	resetInactivityTimer(sessionId: string): void;
}

export function scanSubagentsDir(
	delegate: SubagentWatcherDelegate,
	parser: TranscriptParser,
	sessionId: string,
): void {
	const session = delegate.getSession(sessionId);
	if (!session || !session.subagentsDir) return;

	if (!session.subagentsDirWatcher && fs.existsSync(session.subagentsDir)) {
		try {
			session.subagentsDirWatcher = fs.watch(session.subagentsDir, () => {
				scanSubagentsDir(delegate, parser, sessionId);
			});
		} catch (err) {
			log.debug("Subagent dir watch failed:", err);
		}
	}

	const subDir = session.subagentsDir;
	if (!fs.existsSync(subDir)) return;

	let files: string[];
	try {
		files = fs.readdirSync(subDir);
	} catch (err) {
		log.debug("Subagent dir scan failed:", err);
		return;
	}
	for (const file of files) {
		if (!file.endsWith(".jsonl")) continue;
		const filePath = path.join(subDir, file);
		if (session.subagentWatchers.has(filePath)) continue;
		startWatchingSubagentFile(delegate, parser, filePath, sessionId);
	}
}

function startWatchingSubagentFile(
	delegate: SubagentWatcherDelegate,
	parser: TranscriptParser,
	filePath: string,
	sessionId: string,
): void {
	const session = delegate.getSession(sessionId);
	if (!session) return;
	const agentName = resolveNameFromMeta(filePath, session.subagentWatchers.size + 1);
	log.info(`Tailing subagent ${path.basename(filePath)} as "${agentName}"`);

	const state: SubagentState = {
		watcher: null,
		fileSize: 0,
		agentName,
		pendingToolCalls: new Map(),
		seenToolUseIds: new Set(),
		permissionTimer: null,
		permissionEmitted: false,
		spawnEmitted: false,
	};
	session.subagentWatchers.set(filePath, state);

	const pendingToolUseIds = new Set<string>();
	try {
		const stat = fs.statSync(filePath);
		if (stat.size > 0) {
			const content = fs.readFileSync(filePath, "utf-8");
			for (const line of content.split(/\r?\n/)) {
				if (!line.trim()) continue;
				try {
					const raw = JSON.parse(line.trim()) as {
						message?: { content?: Array<ToolUseBlock | ToolResultBlock | { type: string }> };
					};
					if (raw.message && Array.isArray(raw.message.content)) {
						for (const block of raw.message.content) {
							if (block.type === "tool_use" && "id" in block) {
								state.seenToolUseIds.add(block.id);
								pendingToolUseIds.add(block.id);
							} else if (block.type === "tool_result" && "tool_use_id" in block) {
								pendingToolUseIds.delete(block.tool_use_id);
							}
						}
					}
				} catch {
					/* skip unparseable */
				}
			}
			state.fileSize = stat.size;
		}
	} catch (err) {
		log.debug("Subagent initial read failed:", err);
	}

	const alreadySpawned = session.spawnedSubagents.has(agentName);
	state.spawnEmitted = pendingToolUseIds.size > 0 || alreadySpawned;
	if (pendingToolUseIds.size > 0 && !alreadySpawned) {
		session.spawnedSubagents.add(agentName);
		emitSubagentSpawn(delegate, ORCHESTRATOR_NAME, agentName, agentName, sessionId);
	}

	try {
		state.watcher = fs.watch(filePath, () =>
			readSubagentNewLines(delegate, parser, filePath, sessionId),
		);
	} catch (err) {
		log.debug("Subagent file watch failed:", err);
	}
	// Poll fallback per red-team #11 (macOS fs.watch unreliable).
	const poll = setInterval(
		() => readSubagentNewLines(delegate, parser, filePath, sessionId),
		POLL_FALLBACK_MS,
	);
	if (typeof poll.unref === "function") poll.unref();
}

export function readSubagentNewLines(
	delegate: SubagentWatcherDelegate,
	parser: TranscriptParser,
	filePath: string,
	sessionId: string,
): void {
	const session = delegate.getSession(sessionId);
	if (!session) return;
	const state = session.subagentWatchers.get(filePath);
	if (!state) return;

	const result = readNewFileLines(filePath, state.fileSize);
	if (!result) return;
	state.fileSize = result.newSize;

	if (session.inlineProgressAgents.has(state.agentName)) {
		delegate.resetInactivityTimer(sessionId);
		return;
	}

	if (!state.spawnEmitted) {
		state.spawnEmitted = true;
		if (!session.spawnedSubagents.has(state.agentName)) {
			session.spawnedSubagents.add(state.agentName);
			emitSubagentSpawn(delegate, ORCHESTRATOR_NAME, state.agentName, state.agentName, sessionId);
		}
	}

	for (const line of result.lines) {
		parser.processTranscriptLine(
			line,
			state.agentName,
			state.pendingToolCalls,
			state.seenToolUseIds,
			sessionId,
		);
	}

	handlePermissionDetection(
		delegate,
		state.agentName,
		state.pendingToolCalls,
		state,
		sessionId,
	);
	delegate.resetInactivityTimer(sessionId);
}

