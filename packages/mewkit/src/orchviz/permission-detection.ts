/**
 * Permission detection — flag tool calls pending >PERMISSION_DETECT_MS.
 *
 * Ported from patoles/agent-flow @ 59ccf4e (extension/src/permission-detection.ts).
 * License Apache-2.0 (see ../NOTICE).
 *
 * Phase-02 modifications:
 * - Skip heuristic if a typed pause already covers this agent (pauseRecord parameter).
 * - Dual-emit: legacy permission_requested + new pause_started{permission_request}.
 * - Hard cap: 60s (PERMISSION_HEURISTIC_MAX_MS) clears the heuristic even without tool_result.
 * - [red-team #18] toolUseId omitted for reason=permission_request (no deterministic ID).
 */

import type { AgentEvent, PendingToolCall } from "./protocol.js";
import { PERMISSION_DETECT_MS, PERMISSION_HEURISTIC_MAX_MS } from "./constants.js";

export interface PermissionState {
	permissionTimer: NodeJS.Timeout | null;
	permissionEmitted: boolean;
	/** Hard-cap timer; clears heuristic after PERMISSION_HEURISTIC_MAX_MS. */
	permissionHardCapTimer?: NodeJS.Timeout | null;
}

export interface PermissionDetectionDelegate {
	emit(event: AgentEvent, sessionId?: string): void;
	elapsed(sessionId?: string): number;
	getLastActivityTime(sessionId: string): number | undefined;
}

export function handlePermissionDetection(
	delegate: PermissionDetectionDelegate,
	agentName: string,
	pendingToolCalls: Map<string, PendingToolCall>,
	permState: PermissionState,
	sessionId: string,
	sessionCompleted?: boolean,
	checkSessionActivity?: boolean,
	/** Optional: pauseRecord from parser context — skip heuristic if typed pause active. */
	pauseRecord?: Map<string, { reason: string; toolUseId?: string; startedAt: number }>,
): void {
	if (permState.permissionTimer) {
		clearTimeout(permState.permissionTimer);
		permState.permissionTimer = null;
	}

	if (permState.permissionEmitted) {
		permState.permissionEmitted = false;
		// Clear any hard-cap timer too
		if (permState.permissionHardCapTimer) {
			clearTimeout(permState.permissionHardCapTimer);
			permState.permissionHardCapTimer = null;
		}
		delegate.emit(
			{
				time: delegate.elapsed(sessionId),
				type: "agent_idle",
				payload: { name: agentName },
			},
			sessionId,
		);
	}

	const needsPermission = Array.from(pendingToolCalls.values()).some(
		(tc) => tc.name !== "Agent" && tc.name !== "Task",
	);
	if (!needsPermission) return;

	// Skip if a typed pause already covers this agent (red-team #5 coexistence rule).
	const pauseKey = `${sessionId}:${agentName}`;
	if (pauseRecord?.has(pauseKey)) return;

	const snapshotTime = Date.now();
	permState.permissionTimer = setTimeout(() => {
		if (permState.permissionEmitted || sessionCompleted) return;

		// Re-check typed pause at fire time — may have been set since the timer was created.
		if (pauseRecord?.has(pauseKey)) return;

		const stillPending = Array.from(pendingToolCalls.values()).some(
			(tc) => tc.name !== "Agent" && tc.name !== "Task" && tc.startTime <= snapshotTime,
		);
		if (!stillPending) return;

		if (checkSessionActivity) {
			const lastActivity = delegate.getLastActivityTime(sessionId);
			if (lastActivity !== undefined) {
				const recentThreshold = Date.now() - PERMISSION_DETECT_MS;
				if (lastActivity > recentThreshold) return;
			}
		}

		permState.permissionEmitted = true;

		// Legacy emit (backwards compat) — existing listeners expect this event.
		delegate.emit(
			{
				time: delegate.elapsed(sessionId),
				type: "permission_requested",
				payload: { agent: agentName, message: "Waiting for permission" },
			},
			sessionId,
		);

		// Dual-emit: new typed pause_started (phase-03 clients use this).
		// [red-team #18] toolUseId intentionally omitted — no deterministic single ID
		// when multiple non-Agent/Task tools are pending. Client matches by (agent, reason).
		delegate.emit(
			{
				time: delegate.elapsed(sessionId),
				type: "pause_started",
				payload: {
					agent: agentName,
					reason: "permission_request",
					// toolUseId: omitted per red-team #18
				},
			},
			sessionId,
		);

		// Hard cap: clear heuristic after PERMISSION_HEURISTIC_MAX_MS even without tool_result.
		permState.permissionHardCapTimer = setTimeout(() => {
			if (!permState.permissionEmitted) return;
			permState.permissionEmitted = false;
			permState.permissionHardCapTimer = null;
			delegate.emit(
				{
					time: delegate.elapsed(sessionId),
					type: "pause_cleared",
					payload: {
						agent: agentName,
						reason: "permission_request",
						// toolUseId: omitted (matches by agent+reason in phase-03)
						durationMs: PERMISSION_HEURISTIC_MAX_MS,
					},
				},
				sessionId,
			);
		}, PERMISSION_HEURISTIC_MAX_MS);

		if (
			permState.permissionHardCapTimer &&
			typeof (permState.permissionHardCapTimer as NodeJS.Timeout).unref === "function"
		) {
			(permState.permissionHardCapTimer as NodeJS.Timeout).unref();
		}
	}, PERMISSION_DETECT_MS);

	if (typeof permState.permissionTimer.unref === "function") {
		permState.permissionTimer.unref();
	}
}
