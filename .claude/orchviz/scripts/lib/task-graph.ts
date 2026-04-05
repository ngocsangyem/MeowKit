/**
 * OrchViz — Task Graph
 *
 * Task dependency DAG using plain objects for JSON serialization.
 * Supports cascade unblocking when tasks complete.
 */

import type { OrchEvent } from '../../src/protocol.js';

export interface TaskState {
  id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  owner: string | null;
  blockedBy: string[];
  blocks: string[];
  createdTime: number;
  completedTime: number | null;
}

export interface DependencyEdge {
  from: string;
  to: string;
}

export interface TaskGraph {
  onCreated(event: OrchEvent): void;
  onCompleted(taskId: string): void;
  onUpdated(event: OrchEvent): void;
  assignOwner(taskId: string, agentName: string): void;
  getByStatus(status: TaskState['status']): TaskState[];
  getDependencyEdges(): DependencyEdge[];
  getAll(): Record<string, TaskState>;
  getSnapshot(): Record<string, TaskState>;
}

export function createTaskGraph(): TaskGraph {
  const tasks: Record<string, TaskState> = {};

  function computeInitialStatus(blockedBy: string[]): TaskState['status'] {
    // Blocked if any dependency is not yet completed
    if (blockedBy.length === 0) return 'pending';
    const hasIncomplete = blockedBy.some(
      (id) => !tasks[id] || tasks[id].status !== 'completed',
    );
    return hasIncomplete ? 'blocked' : 'pending';
  }

  function onCreated(event: OrchEvent): void {
    const ctx = event.taskContext;
    if (!ctx) return;

    const blockedBy = ctx.blockedBy ?? [];
    const taskId = ctx.taskId;

    const task: TaskState = {
      id: taskId,
      subject: ctx.subject,
      status: computeInitialStatus(blockedBy),
      owner: ctx.owner,
      blockedBy: [...blockedBy],
      blocks: [],
      createdTime: event.timestamp,
      completedTime: null,
    };

    tasks[taskId] = task;

    // Register reverse edges: this task is blocked by others → those tasks block this one
    for (const depId of blockedBy) {
      if (!tasks[depId]) {
        // Lazy init incomplete dependency placeholder
        tasks[depId] = {
          id: depId,
          subject: '',
          status: 'pending',
          owner: null,
          blockedBy: [],
          blocks: [],
          createdTime: event.timestamp,
          completedTime: null,
        };
      }
      if (!tasks[depId].blocks.includes(taskId)) {
        tasks[depId].blocks.push(taskId);
      }
    }
  }

  function onCompleted(taskId: string): void {
    const task = tasks[taskId];
    if (!task) return;

    task.status = 'completed';
    task.completedTime = Date.now();

    // Cascade: unblock tasks that were waiting on this one
    for (const blockedTaskId of task.blocks) {
      const blockedTask = tasks[blockedTaskId];
      if (!blockedTask) continue;

      blockedTask.blockedBy = blockedTask.blockedBy.filter((id) => id !== taskId);
      if (blockedTask.status === 'blocked' && blockedTask.blockedBy.length === 0) {
        blockedTask.status = 'pending';
      }
    }
  }

  function onUpdated(event: OrchEvent): void {
    const ctx = event.taskContext;
    if (!ctx) return;

    const task = tasks[ctx.taskId];
    if (!task) return;

    if (ctx.subject) task.subject = ctx.subject;
    if (ctx.owner !== undefined) task.owner = ctx.owner;

    // Map status string to TaskState status
    if (ctx.status === 'completed') {
      onCompleted(ctx.taskId);
    } else if (ctx.status === 'in_progress') {
      task.status = 'in_progress';
    } else if (ctx.status === 'pending') {
      task.status = 'pending';
    }
  }

  function assignOwner(taskId: string, agentName: string): void {
    const task = tasks[taskId];
    if (!task) return;
    task.owner = agentName;
    task.status = 'in_progress';
  }

  function getByStatus(status: TaskState['status']): TaskState[] {
    return Object.values(tasks).filter((t) => t.status === status);
  }

  function getDependencyEdges(): DependencyEdge[] {
    const edges: DependencyEdge[] = [];
    for (const task of Object.values(tasks)) {
      for (const depId of task.blockedBy) {
        edges.push({ from: depId, to: task.id });
      }
    }
    return edges;
  }

  function getAll(): Record<string, TaskState> {
    return tasks;
  }

  function getSnapshot(): Record<string, TaskState> {
    // Return deep copy for safe serialization
    return JSON.parse(JSON.stringify(tasks)) as Record<string, TaskState>;
  }

  return { onCreated, onCompleted, onUpdated, assignOwner, getByStatus, getDependencyEdges, getAll, getSnapshot };
}
