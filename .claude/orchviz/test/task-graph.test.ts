/**
 * OrchViz — Task Graph Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTaskGraph, type TaskGraph } from '../scripts/lib/task-graph.js';
import type { OrchEvent } from '../src/protocol.js';

function makeEvent(overrides: Partial<OrchEvent> = {}): OrchEvent {
  return {
    seq: 1,
    timestamp: Date.now(),
    sessionId: 'sess-test',
    eventType: 'PostToolUse',
    redactedPayload: {},
    agent: null,
    workflowStep: 'unknown',
    planContext: null,
    taskContext: null,
    toolContext: null,
    statusProtocol: null,
    contextBreakdown: null,
    fileAttention: null,
    ...overrides,
  };
}

function makeTaskEvent(
  taskId: string,
  subject: string,
  blockedBy: string[] = [],
  toolName = 'TaskCreate',
): OrchEvent {
  return makeEvent({
    taskContext: { taskId, subject, owner: null, status: 'pending', blockedBy },
    toolContext: { name: toolName, filePath: null, duration: null, tokenCost: null, isError: false },
  });
}

describe('createTaskGraph', () => {
  let graph: TaskGraph;

  beforeEach(() => {
    graph = createTaskGraph();
  });

  // ── Creation ──

  it('creates a task with pending status when no blockedBy', () => {
    graph.onCreated(makeTaskEvent('1', 'Setup environment'));
    const tasks = graph.getAll();
    expect(tasks['1']).toBeDefined();
    expect(tasks['1'].status).toBe('pending');
    expect(tasks['1'].subject).toBe('Setup environment');
    expect(tasks['1'].blockedBy).toEqual([]);
  });

  it('creates a task with blocked status when blockedBy has incomplete tasks', () => {
    graph.onCreated(makeTaskEvent('1', 'Task A'));
    graph.onCreated(makeTaskEvent('2', 'Task B depends on A', ['1']));
    expect(graph.getAll()['2'].status).toBe('blocked');
  });

  it('creates task with pending status when all blockedBy are completed', () => {
    graph.onCreated(makeTaskEvent('1', 'Task A'));
    graph.onCompleted('1');
    graph.onCreated(makeTaskEvent('2', 'Task B depends on done A', ['1']));
    expect(graph.getAll()['2'].status).toBe('pending');
  });

  // ── Cascade Unblocking ──

  it('unblocks task when its dependency completes', () => {
    graph.onCreated(makeTaskEvent('1', 'Task A'));
    graph.onCreated(makeTaskEvent('2', 'Task B', ['1']));

    expect(graph.getAll()['2'].status).toBe('blocked');
    graph.onCompleted('1');
    expect(graph.getAll()['2'].status).toBe('pending');
  });

  it('keeps task blocked until ALL dependencies complete', () => {
    graph.onCreated(makeTaskEvent('1', 'Task A'));
    graph.onCreated(makeTaskEvent('2', 'Task B'));
    graph.onCreated(makeTaskEvent('3', 'Task C', ['1', '2']));

    graph.onCompleted('1');
    expect(graph.getAll()['3'].status).toBe('blocked'); // still blocked by 2

    graph.onCompleted('2');
    expect(graph.getAll()['3'].status).toBe('pending'); // now unblocked
  });

  it('registers reverse edges (blocks) on dependency', () => {
    graph.onCreated(makeTaskEvent('1', 'Task A'));
    graph.onCreated(makeTaskEvent('2', 'Task B', ['1']));

    expect(graph.getAll()['1'].blocks).toContain('2');
  });

  // ── assignOwner ──

  it('assignOwner sets owner and status to in_progress', () => {
    graph.onCreated(makeTaskEvent('1', 'Task A'));
    graph.assignOwner('1', 'developer-abc1');

    const task = graph.getAll()['1'];
    expect(task.owner).toBe('developer-abc1');
    expect(task.status).toBe('in_progress');
  });

  it('assignOwner is a no-op for unknown task', () => {
    // Should not throw
    expect(() => graph.assignOwner('999', 'agent')).not.toThrow();
  });

  // ── getDependencyEdges ──

  it('returns correct dependency edges', () => {
    graph.onCreated(makeTaskEvent('1', 'A'));
    graph.onCreated(makeTaskEvent('2', 'B', ['1']));
    graph.onCreated(makeTaskEvent('3', 'C', ['1', '2']));

    const edges = graph.getDependencyEdges();
    expect(edges).toContainEqual({ from: '1', to: '2' });
    expect(edges).toContainEqual({ from: '1', to: '3' });
    expect(edges).toContainEqual({ from: '2', to: '3' });
  });

  it('returns empty edges when no dependencies', () => {
    graph.onCreated(makeTaskEvent('1', 'A'));
    graph.onCreated(makeTaskEvent('2', 'B'));
    expect(graph.getDependencyEdges()).toHaveLength(0);
  });

  // ── getByStatus ──

  it('filters tasks by status', () => {
    graph.onCreated(makeTaskEvent('1', 'A'));
    graph.onCreated(makeTaskEvent('2', 'B', ['1']));
    graph.onCompleted('1');

    expect(graph.getByStatus('completed')).toHaveLength(1);
    expect(graph.getByStatus('blocked')).toHaveLength(0); // unblocked by completion
    expect(graph.getByStatus('pending')).toHaveLength(1); // task 2 unblocked
  });

  // ── getSnapshot serialization ──

  it('getSnapshot returns JSON-serializable plain object', () => {
    graph.onCreated(makeTaskEvent('1', 'A'));
    const snapshot = graph.getSnapshot();
    expect(() => JSON.stringify(snapshot)).not.toThrow();
    expect(JSON.parse(JSON.stringify(snapshot))['1'].subject).toBe('A');
  });

  // ── Cross-dependencies ──

  it('handles concurrent tasks with cross-dependencies', () => {
    graph.onCreated(makeTaskEvent('1', 'Init'));
    graph.onCreated(makeTaskEvent('2', 'Feature A', ['1']));
    graph.onCreated(makeTaskEvent('3', 'Feature B', ['1']));
    graph.onCreated(makeTaskEvent('4', 'Merge', ['2', '3']));

    graph.onCompleted('1');
    expect(graph.getAll()['2'].status).toBe('pending');
    expect(graph.getAll()['3'].status).toBe('pending');
    expect(graph.getAll()['4'].status).toBe('blocked');

    graph.onCompleted('2');
    expect(graph.getAll()['4'].status).toBe('blocked'); // still waiting on 3

    graph.onCompleted('3');
    expect(graph.getAll()['4'].status).toBe('pending');
  });
});
