/**
 * Permission detection — flag tool calls pending >PERMISSION_DETECT_MS.
 *
 * Ported from patoles/agent-flow @ 59ccf4e (extension/src/permission-detection.ts).
 * License Apache-2.0 (see ../NOTICE).
 */

import type { AgentEvent, PendingToolCall } from "./protocol.js";
import { PERMISSION_DETECT_MS } from "./constants.js";

export interface PermissionState {
	permissionTimer: NodeJS.Timeout | null;
	permissionEmitted: boolean;
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
): void {
	if (permState.permissionTimer) {
		clearTimeout(permState.permissionTimer);
		permState.permissionTimer = null;
	}

	if (permState.permissionEmitted) {
		permState.permissionEmitted = false;
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

	const snapshotTime = Date.now();
	permState.permissionTimer = setTimeout(() => {
		if (permState.permissionEmitted || sessionCompleted) return;
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
		delegate.emit(
			{
				time: delegate.elapsed(sessionId),
				type: "permission_requested",
				payload: { agent: agentName, message: "Waiting for permission" },
			},
			sessionId,
		);
	}, PERMISSION_DETECT_MS);

	if (typeof permState.permissionTimer.unref === "function") {
		permState.permissionTimer.unref();
	}
}
