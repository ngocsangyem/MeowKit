/**
 * OrchViz — Task Event Handler
 *
 * Processes task lifecycle events inferred from PostToolUse of
 * TaskCreate / TaskUpdate tool calls.
 */

import type { OrchSimulationState, OrchEvent, TaskNode } from './types';

export function handleTaskInferred(state: OrchSimulationState, event: OrchEvent): void {
  const ctx = event.taskContext;
  if (!ctx) return;

  const existing = state.tasks[ctx.id];

  const node: TaskNode = {
    id: ctx.id,
    subject: ctx.subject ?? existing?.subject ?? '',
    status: (ctx.status as TaskNode['status']) ?? existing?.status ?? 'pending',
    owner: ctx.owner ?? existing?.owner ?? null,
    blockedBy: ctx.blockedBy ?? existing?.blockedBy ?? [],
  };

  state.tasks[ctx.id] = node;

  // Cascade unblocking: when a task completes, remove it from other tasks' blockedBy lists
  if (node.status === 'completed') {
    cascadeUnblock(state, node.id);
  }
}

/** Remove completedId from all tasks' blockedBy; transition pending→pending (visual cue only) */
function cascadeUnblock(state: OrchSimulationState, completedId: string): void {
  for (const task of Object.values(state.tasks)) {
    if (task.blockedBy.includes(completedId)) {
      task.blockedBy = task.blockedBy.filter(id => id !== completedId);
      // If no more blockers and task is still blocked, revert to pending
      if (task.blockedBy.length === 0 && task.status === 'blocked') {
        task.status = 'pending';
      }
    }
  }
}
