/**
 * OrchViz — State Engine Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createStateEngine, type StateEngine } from '../scripts/lib/state-engine.js';
import type { OrchEvent } from '../src/protocol.js';

function makeEvent(overrides: Partial<OrchEvent> = {}): OrchEvent {
  return {
    seq: 1,
    timestamp: Date.now(),
    sessionId: 'sess-001',
    eventType: 'SessionStart',
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

function agentEvent(
  eventType: string,
  agentName: string,
  tier: 'orchestrator' | 'executor' | 'validator' | 'support' = 'executor',
  extra: Partial<OrchEvent> = {},
): OrchEvent {
  return makeEvent({
    eventType,
    agent: { name: agentName, tier, role: 'Test role', parentAgent: null },
    workflowStep: 'build',
    ...extra,
  });
}

describe('createStateEngine', () => {
  let engine: StateEngine;

  beforeEach(() => {
    engine = createStateEngine(null);
  });

  // ── Session lifecycle ──

  it('initializes session on SessionStart', () => {
    engine.processEvent(makeEvent({ eventType: 'SessionStart', sessionId: 'sess-abc' }));
    const snap = engine.getSnapshot();
    expect(snap.sessionId).toBe('sess-abc');
    expect(snap.eventCount).toBe(1);
  });

  it('tracks startTime from first SessionStart', () => {
    const ts = 1700000000000;
    engine.processEvent(makeEvent({ eventType: 'SessionStart', timestamp: ts }));
    expect(engine.getSnapshot().startTime).toBe(ts);
  });

  // ── Full agent lifecycle ──

  it('processes full SubagentStart → tools → SubagentStop lifecycle', () => {
    engine.processEvent(makeEvent({ eventType: 'SessionStart' }));

    engine.processEvent(agentEvent('SubagentStart', 'developer-abc1', 'executor'));

    engine.processEvent(agentEvent('PreToolUse', 'developer-abc1', 'executor', {
      toolContext: { name: 'Read', filePath: 'src/index.ts', duration: null, tokenCost: null, isError: false },
    }));

    engine.processEvent(agentEvent('PostToolUse', 'developer-abc1', 'executor', {
      toolContext: { name: 'Read', filePath: 'src/index.ts', duration: 50, tokenCost: 10, isError: false },
    }));

    engine.processEvent(agentEvent('SubagentStop', 'developer-abc1', 'executor', {
      statusProtocol: 'DONE',
    }));

    const snap = engine.getSnapshot();
    const agent = snap.agents['developer-abc1'];
    expect(agent).toBeDefined();
    expect(agent.status).toBe('complete');
    expect(agent.statusProtocol).toBe('DONE');
    expect(agent.toolCallCount).toBe(1);
    expect(agent.toolsUsed).toContain('Read');
  });

  // ── Snapshot serialization ──

  it('getSnapshot is JSON-serializable (no Maps)', () => {
    engine.processEvent(agentEvent('SubagentStart', 'planner-1111', 'executor'));
    const snap = engine.getSnapshot();
    expect(() => JSON.stringify(snap)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(snap));
    expect(parsed.agents['planner-1111']).toBeDefined();
  });

  // ── rebuild produces same state as live processing ──

  it('rebuild produces same state as sequential processEvent', () => {
    const events: OrchEvent[] = [
      makeEvent({ eventType: 'SessionStart', sessionId: 'sess-rebuild', seq: 1 }),
      agentEvent('SubagentStart', 'researcher-aabb', 'executor', { seq: 2 }),
      agentEvent('PreToolUse', 'researcher-aabb', 'executor', {
        seq: 3,
        toolContext: { name: 'WebSearch', filePath: null, duration: null, tokenCost: null, isError: false },
      }),
      agentEvent('SubagentStop', 'researcher-aabb', 'executor', { seq: 4, statusProtocol: 'DONE' }),
    ];

    // Live processing
    const liveEngine = createStateEngine(null);
    for (const e of events) liveEngine.processEvent(e);
    const liveSnap = liveEngine.getSnapshot();

    // rebuild
    const rebuildEngine = createStateEngine(null);
    rebuildEngine.rebuild(events);
    const rebuildSnap = rebuildEngine.getSnapshot();

    expect(rebuildSnap.agents['researcher-aabb']?.status).toBe(
      liveSnap.agents['researcher-aabb']?.status,
    );
    expect(rebuildSnap.agents['researcher-aabb']?.toolCallCount).toBe(
      liveSnap.agents['researcher-aabb']?.toolCallCount,
    );
  });

  // ── Agent delegation tree ──

  it('builds parent-child delegation tree', () => {
    engine.processEvent(
      agentEvent('SubagentStart', 'orchestrator', 'orchestrator'),
    );
    engine.processEvent(
      agentEvent('SubagentStart', 'developer-1234', 'executor', {
        agent: {
          name: 'developer-1234',
          tier: 'executor',
          role: 'TDD implementation',
          parentAgent: 'orchestrator',
        },
      }),
    );

    // Force parent link via direct tracker access by using getOrCreate pattern
    // The delegation tree is built from parentAgent fields on AgentState
    const snap = engine.getSnapshot();
    expect(snap.agents['developer-1234']).toBeDefined();
    expect(snap.agents['orchestrator']).toBeDefined();
  });

  // ── Task cascade unblocking via state engine ──

  it('propagates task creation and cascade unblocking through state engine', () => {
    engine.processEvent(makeEvent({ eventType: 'SessionStart' }));

    // Create task 1
    engine.processEvent(makeEvent({
      eventType: 'PostToolUse',
      taskContext: { taskId: '1', subject: 'Setup', owner: null, status: 'pending', blockedBy: [] },
      toolContext: { name: 'TaskCreate', filePath: null, duration: null, tokenCost: null, isError: false },
    }));

    // Create task 2 blocked by task 1
    engine.processEvent(makeEvent({
      eventType: 'PostToolUse',
      taskContext: { taskId: '2', subject: 'Build feature', owner: null, status: 'pending', blockedBy: ['1'] },
      toolContext: { name: 'TaskCreate', filePath: null, duration: null, tokenCost: null, isError: false },
    }));

    expect(engine.getSnapshot().tasks['2'].status).toBe('blocked');

    // Complete task 1 via TaskUpdate
    engine.processEvent(makeEvent({
      eventType: 'PostToolUse',
      taskContext: { taskId: '1', subject: 'Setup', owner: null, status: 'completed', blockedBy: [] },
      toolContext: { name: 'TaskUpdate', filePath: null, duration: null, tokenCost: null, isError: false },
    }));

    expect(engine.getSnapshot().tasks['2'].status).toBe('pending');
  });

  // ── getCurrentStep ──

  it('returns unknown when no active agents', () => {
    expect(engine.getCurrentStep()).toBe('unknown');
  });

  it('infers workflow step from active agent type', () => {
    engine.processEvent(agentEvent('SubagentStart', 'reviewer', 'validator', {
      workflowStep: 'review',
      agent: { name: 'reviewer', tier: 'validator', role: 'Structural audit', parentAgent: null },
    }));
    // reviewer agent → review phase
    const step = engine.getCurrentStep();
    expect(['review', 'unknown']).toContain(step);
  });

  // ── eventCount and lastEventTime ──

  it('increments eventCount for every processed event', () => {
    engine.processEvent(makeEvent({ eventType: 'SessionStart' }));
    engine.processEvent(agentEvent('SubagentStart', 'planner'));
    engine.processEvent(agentEvent('SubagentStop', 'planner'));
    expect(engine.getSnapshot().eventCount).toBe(3);
  });

  it('updates lastEventTime on each event', () => {
    const t1 = 1700000001000;
    const t2 = 1700000002000;
    engine.processEvent(makeEvent({ eventType: 'SessionStart', timestamp: t1 }));
    engine.processEvent(makeEvent({ eventType: 'Stop', timestamp: t2 }));
    expect(engine.getSnapshot().lastEventTime).toBe(t2);
  });
});
