import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyTier,
  inferWorkflowStep,
  buildAgentInfo,
  AGENT_TIERS,
  WORKFLOW_PHASES,
} from '../src/orch-model.js';
import {
  createEnricherState,
  enrich,
  extractTaskContext,
} from '../src/orch-enricher.js';
import type { HookPayload } from '../src/protocol.js';
import type { EnricherState } from '../src/orch-enricher.js';

// ── classifyTier (aligned with MeowKit agents) ──

describe('classifyTier', () => {
  it('classifies orchestrator agent', () => {
    expect(classifyTier('orchestrator')).toBe('orchestrator');
  });

  it('classifies executor agents (MeowKit core pipeline)', () => {
    expect(classifyTier('planner')).toBe('executor');
    expect(classifyTier('researcher')).toBe('executor');
    expect(classifyTier('developer')).toBe('executor');
    expect(classifyTier('tester')).toBe('executor');
    expect(classifyTier('brainstormer')).toBe('executor');
    expect(classifyTier('ui-ux-designer')).toBe('executor');
  });

  it('classifies validator agents (MeowKit quality gates)', () => {
    expect(classifyTier('reviewer')).toBe('validator');
    expect(classifyTier('security')).toBe('validator');
    expect(classifyTier('architect')).toBe('validator');
  });

  it('classifies support agents', () => {
    expect(classifyTier('documenter')).toBe('support');
    expect(classifyTier('analyst')).toBe('support');
    expect(classifyTier('shipper')).toBe('support');
    expect(classifyTier('git-manager')).toBe('support');
    expect(classifyTier('journal-writer')).toBe('support');
  });

  it('strips session ID suffixes', () => {
    expect(classifyTier('researcher-a1b2c3d4')).toBe('executor');
    expect(classifyTier('reviewer-ABCD')).toBe('validator');
  });

  it('defaults unknown agents to executor', () => {
    expect(classifyTier('unknown-agent')).toBe('executor');
    expect(classifyTier('custom-tool')).toBe('executor');
  });
});

// ── inferWorkflowStep (aligned with MeowKit 7-phase workflow) ──

describe('inferWorkflowStep', () => {
  it('maps orchestrator to orient phase', () => {
    expect(inferWorkflowStep('orchestrator')).toBe('orient');
  });

  it('maps planner/architect/researcher to plan phase', () => {
    expect(inferWorkflowStep('planner')).toBe('plan');
    expect(inferWorkflowStep('architect')).toBe('plan');
    expect(inferWorkflowStep('researcher')).toBe('plan');
  });

  it('maps tester/security to test-red phase', () => {
    expect(inferWorkflowStep('tester')).toBe('test-red');
    expect(inferWorkflowStep('security')).toBe('test-red');
  });

  it('maps developer to build phase', () => {
    expect(inferWorkflowStep('developer')).toBe('build');
    expect(inferWorkflowStep('ui-ux-designer')).toBe('build');
  });

  it('maps reviewer to review phase', () => {
    expect(inferWorkflowStep('reviewer')).toBe('review');
  });

  it('maps shipper/git-manager to ship phase', () => {
    expect(inferWorkflowStep('shipper')).toBe('ship');
    expect(inferWorkflowStep('git-manager')).toBe('ship');
  });

  it('maps documenter/analyst/journal-writer to reflect phase', () => {
    expect(inferWorkflowStep('documenter')).toBe('reflect');
    expect(inferWorkflowStep('analyst')).toBe('reflect');
    expect(inferWorkflowStep('journal-writer')).toBe('reflect');
  });

  it('returns unknown for unrecognized agents', () => {
    expect(inferWorkflowStep('mystery-agent')).toBe('unknown');
  });

  it('strips session ID suffixes', () => {
    expect(inferWorkflowStep('researcher-a1b2')).toBe('plan');
  });
});

// ── buildAgentInfo ──

describe('buildAgentInfo', () => {
  it('builds correct info with agent ID', () => {
    const info = buildAgentInfo('researcher', 'abc12345', 'orchestrator');
    expect(info.name).toBe('researcher-2345');
    expect(info.tier).toBe('executor');
    expect(info.parentAgent).toBe('orchestrator');
    expect(info.role).toBe('Technical research');
  });

  it('uses agent type as name when no ID', () => {
    const info = buildAgentInfo('planner', null, null);
    expect(info.name).toBe('planner');
    expect(info.role).toBe('Two-lens plan, Gate 1');
  });

  it('gives known role for MeowKit agents', () => {
    expect(buildAgentInfo('security', null, null).role).toBe('Audit, BLOCK verdicts');
    expect(buildAgentInfo('shipper', null, null).role).toBe('Deploy pipeline');
  });

  it('falls back to tier role for unknown agents', () => {
    const info = buildAgentInfo('custom-agent', null, null);
    expect(info.role).toBe('Executes tasks'); // executor fallback
  });
});

// ── WORKFLOW_PHASES ──

describe('WORKFLOW_PHASES', () => {
  it('has 7 phases matching MeowKit', () => {
    expect(WORKFLOW_PHASES).toEqual([
      'orient', 'plan', 'test-red', 'build', 'review', 'ship', 'reflect',
    ]);
  });
});

// ── enrich ──

describe('enrich', () => {
  let state: EnricherState;

  beforeEach(() => {
    state = createEnricherState(null);
  });

  it('enriches SubagentStart with MeowKit agent classification', () => {
    const payload: HookPayload = {
      session_id: 'sess-001',
      hook_event_name: 'SubagentStart',
      agent_type: 'developer',
      agent_id: 'abcd1234',
    };

    const event = enrich(payload, state);

    expect(event.agent).not.toBeNull();
    expect(event.agent!.tier).toBe('executor');
    expect(event.workflowStep).toBe('build'); // MeowKit Phase 3
    expect(event.seq).toBe(1);
  });

  it('enriches security agent to test-red phase', () => {
    const payload: HookPayload = {
      session_id: 'sess-001',
      hook_event_name: 'SubagentStart',
      agent_type: 'security',
    };

    const event = enrich(payload, state);

    expect(event.agent!.tier).toBe('validator');
    expect(event.workflowStep).toBe('test-red');
  });

  it('redacts rawPayload per allowlist (RT-14)', () => {
    const payload: HookPayload = {
      session_id: 'sess-001',
      hook_event_name: 'PostToolUse',
      tool_name: 'Read',
      tool_use_id: 'tu-001',
      tool_input: { file_path: '/secret/passwords.txt' },
      tool_response: 'file contents here...',
    };

    const event = enrich(payload, state);

    expect(event.redactedPayload).toHaveProperty('tool_name', 'Read');
    expect(event.redactedPayload).toHaveProperty('tool_use_id', 'tu-001');
    expect(event.redactedPayload).not.toHaveProperty('tool_input');
    expect(event.redactedPayload).not.toHaveProperty('tool_response');
  });

  it('increments sequence numbers monotonically', () => {
    const payload: HookPayload = {
      session_id: 'sess-001',
      hook_event_name: 'SessionStart',
    };

    const e1 = enrich(payload, state);
    const e2 = enrich(payload, state);
    const e3 = enrich(payload, state);

    expect(e1.seq).toBe(1);
    expect(e2.seq).toBe(2);
    expect(e3.seq).toBe(3);
  });

  it('handles missing/null fields without throwing', () => {
    const payload: HookPayload = {
      session_id: 'sess-001',
      hook_event_name: 'UnknownEvent',
    };

    const event = enrich(payload, state);

    expect(event.agent).toBeNull();
    expect(event.workflowStep).toBe('unknown');
    expect(event.planContext).toBeNull();
    expect(event.taskContext).toBeNull();
    expect(event.toolContext).toBeNull();
    expect(event.statusProtocol).toBeNull();
  });

  it('extracts tool context from PostToolUse', () => {
    const payload: HookPayload = {
      session_id: 'sess-001',
      hook_event_name: 'PostToolUse',
      tool_name: 'Read',
      tool_input: { file_path: 'src/index.ts' },
      tool_response: 'const x = 1;\n',
    };

    const event = enrich(payload, state);

    expect(event.toolContext).not.toBeNull();
    expect(event.toolContext!.name).toBe('Read');
    expect(event.toolContext!.filePath).toBe('src/index.ts');
    expect(event.toolContext!.tokenCost).toBeGreaterThan(0);
  });

  it('uses agent_type for workflow step (M3 fix)', () => {
    const payload: HookPayload = {
      session_id: 'sess-001',
      hook_event_name: 'SubagentStart',
      agent_type: 'reviewer',
      agent_id: 'xyz99999',
    };

    const event = enrich(payload, state);

    // Should use agent_type 'reviewer' not constructed name 'reviewer-9999'
    expect(event.workflowStep).toBe('review');
  });
});

// ── extractTaskContext (RT-1) ──

describe('extractTaskContext', () => {
  it('extracts task from TaskCreate tool response', () => {
    const payload: HookPayload = {
      session_id: 'sess-001',
      hook_event_name: 'PostToolUse',
      tool_name: 'TaskCreate',
      tool_input: {
        subject: 'Implement auth endpoints',
        description: 'Build the login and signup routes',
        addBlockedBy: ['1', '2'],
      },
      tool_response: 'Task #5 created successfully',
    };

    const ctx = extractTaskContext(payload);

    expect(ctx).not.toBeNull();
    expect(ctx!.taskId).toBe('5');
    expect(ctx!.subject).toBe('Implement auth endpoints');
    expect(ctx!.blockedBy).toEqual(['1', '2']);
    expect(ctx!.status).toBe('pending');
  });

  it('handles missing tool_input gracefully', () => {
    const payload: HookPayload = {
      session_id: 'sess-001',
      hook_event_name: 'PostToolUse',
      tool_name: 'TaskCreate',
    };

    const ctx = extractTaskContext(payload);
    expect(ctx).toBeNull();
  });

  it('handles object tool_response', () => {
    const payload: HookPayload = {
      session_id: 'sess-001',
      hook_event_name: 'PostToolUse',
      tool_name: 'TaskCreate',
      tool_input: { subject: 'Test task' },
      tool_response: { content: 'Task #12 created' },
    };

    const ctx = extractTaskContext(payload);
    expect(ctx!.taskId).toBe('12');
  });
});

// ── Status Protocol Detection ──

describe('status protocol detection', () => {
  it('detects DONE status from SubagentStop', () => {
    const state = createEnricherState(null);
    const payload: HookPayload = {
      session_id: 'sess-001',
      hook_event_name: 'SubagentStop',
      agent_type: 'reviewer',
      tool_response: '**Status:** DONE\n**Summary:** All checks passed.',
    };

    const event = enrich(payload, state);
    expect(event.statusProtocol).toBe('DONE');
  });

  it('detects BLOCKED status', () => {
    const state = createEnricherState(null);
    const payload: HookPayload = {
      session_id: 'sess-001',
      hook_event_name: 'SubagentStop',
      agent_type: 'tester',
      tool_response: '**Status:** BLOCKED\n**Summary:** Missing dependencies.',
    };

    const event = enrich(payload, state);
    expect(event.statusProtocol).toBe('BLOCKED');
  });

  it('returns null when no status found', () => {
    const state = createEnricherState(null);
    const payload: HookPayload = {
      session_id: 'sess-001',
      hook_event_name: 'SubagentStop',
      agent_type: 'planner',
      tool_response: 'Plan complete.',
    };

    const event = enrich(payload, state);
    expect(event.statusProtocol).toBeNull();
  });
});
