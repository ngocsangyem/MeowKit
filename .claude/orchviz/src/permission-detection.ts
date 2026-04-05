/**
 * OrchViz — Permission Detection
 *
 * Detects when a tool call has been pending longer than PERMISSION_DETECT_MS,
 * indicating the agent is waiting for user permission approval.
 *
 * Follows Agent Flow's permission-detection.ts pattern exactly.
 */

import { log } from './logger.js';

const PERMISSION_DETECT_MS = 5000;

export interface PermissionState {
  permissionTimer: ReturnType<typeof setTimeout> | null;
  permissionEmitted: boolean;
}

export interface PendingToolCall {
  name: string;
  startTime: number;
}

/**
 * Cancel any pending permission timer, clear emitted state, and (re)start
 * detection if non-Agent/Task tools are still pending.
 *
 * Call this after every new file read to reset the timer window.
 */
export function handlePermissionDetection(
  agentName: string,
  pendingToolCalls: Map<string, PendingToolCall>,
  permState: PermissionState,
  onEmit: (type: string, payload: Record<string, unknown>) => void,
): void {
  // 1. Cancel existing timer
  if (permState.permissionTimer) {
    clearTimeout(permState.permissionTimer);
    permState.permissionTimer = null;
  }

  // 2. If permission was emitted, retract it with agent_idle
  if (permState.permissionEmitted) {
    permState.permissionEmitted = false;
    onEmit('agent_idle', { name: agentName });
  }

  // 3. Check if any non-Agent/Task tool is pending
  const needsPermission = Array.from(pendingToolCalls.values()).some(
    (tc) => tc.name !== 'Agent' && tc.name !== 'Task',
  );
  if (!needsPermission) return;

  // 4. Start 5s timer
  const snapshotTime = Date.now();
  permState.permissionTimer = setTimeout(() => {
    if (permState.permissionEmitted) return;

    // 5. Re-check: only fire if tools from before the timer are still pending
    const stillPending = Array.from(pendingToolCalls.values()).some(
      (tc) => tc.name !== 'Agent' && tc.name !== 'Task' && tc.startTime <= snapshotTime,
    );
    if (!stillPending) return;

    log.debug(`Permission wait detected for agent: ${agentName}`);
    permState.permissionEmitted = true;
    onEmit('permission_requested', {
      agent: agentName,
      message: 'Waiting for permission',
    });
  }, PERMISSION_DETECT_MS);
}
