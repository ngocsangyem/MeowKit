/**
 * OrchViz — Orchestration State Engine
 *
 * Main state machine composing agent-tracker, task-graph, and plan-binder.
 * Processes enriched OrchEvents and maintains a live projection of orchestration state.
 */

import { AGENT_PHASE_MAP, WORKFLOW_PHASES } from '../../src/orch-model.js';
import type { OrchEvent, FileAttention } from '../../src/protocol.js';
import { createAgentTracker, type AgentState } from './agent-tracker.js';
import { createTaskGraph, type TaskState } from './task-graph.js';
import { createPlanBinder, type PlanExecution } from './plan-binder.js';

export interface FileAttentionEntry extends FileAttention {
  /** Agent names that accessed this path */
  agents: string[];
}

export interface OrchestrationState {
  sessionId: string | null;
  currentStep: string;
  agents: Record<string, AgentState>;
  tasks: Record<string, TaskState>;
  plan: PlanExecution | null;
  eventCount: number;
  startTime: number;
  lastEventTime: number;
  /** Accumulated file attention across all events — keyed by path */
  fileAttention: Record<string, FileAttentionEntry>;
  /** Per-agent event history for conversation threading (capped at 200 per agent) */
  conversations: Record<string, OrchEvent[]>;
}

export interface StateEngine {
  processEvent(event: OrchEvent): void;
  getSnapshot(): OrchestrationState;
  rebuild(events: OrchEvent[]): void;
  getCurrentStep(): string;
}

export function createStateEngine(plansDir: string | null): StateEngine {
  const agentTracker = createAgentTracker();
  const taskGraph = createTaskGraph();
  const planBinder = createPlanBinder(plansDir);

  let sessionId: string | null = null;
  let eventCount = 0;
  let startTime = Date.now();
  let lastEventTime = Date.now();
  const fileAttentionMap: Record<string, FileAttentionEntry> = {};
  const conversations: Record<string, OrchEvent[]> = {};

  function processEvent(event: OrchEvent): void {
    eventCount++;
    lastEventTime = event.timestamp;

    if (!sessionId && event.sessionId) {
      sessionId = event.sessionId;
    }

    // Accumulate file attention from any event that has it
    if (event.fileAttention && event.fileAttention.length > 0) {
      const agentName = event.agent?.name ?? 'unknown';
      for (const fa of event.fileAttention) {
        const existing = fileAttentionMap[fa.path];
        if (existing) {
          existing.tokenCost += fa.tokenCost;
          if (!existing.agents.includes(agentName)) {
            existing.agents.push(agentName);
          }
        } else {
          fileAttentionMap[fa.path] = { ...fa, agents: [agentName] };
        }
      }
    }

    // Track per-agent conversation threading
    const agentName = event.agent?.name;
    if (agentName) {
      if (!conversations[agentName]) conversations[agentName] = [];
      conversations[agentName].push(event);
      // Cap at 200 events per agent to prevent unbounded growth
      if (conversations[agentName].length > 200) {
        conversations[agentName] = conversations[agentName].slice(-200);
      }
    }

    // Sync contextBreakdown from event into agent tracker
    if (event.contextBreakdown && event.agent?.name) {
      const agentState = agentTracker.getOrCreate(event.agent.name);
      agentState.contextBreakdown = event.contextBreakdown;
    }

    switch (event.eventType) {
      case 'SessionStart':
        sessionId = event.sessionId;
        startTime = event.timestamp;
        break;

      case 'SubagentStart':
        agentTracker.onSpawn(event);
        // Bind agent to plan phase if plan context available
        if (event.planContext) {
          planBinder.bindAgent(
            event.agent?.name ?? 'unknown',
            event.planContext.phaseId,
          );
        }
        break;

      case 'SubagentStop':
        agentTracker.onComplete(event);
        break;

      case 'PreToolUse':
        agentTracker.onToolCallStart(event);
        break;

      case 'PostToolUse':
        agentTracker.onToolCallEnd(event);
        // Handle task tool events
        if (event.taskContext) {
          const toolName = event.toolContext?.name ?? '';
          if (toolName === 'TaskCreate') {
            taskGraph.onCreated(event);
          } else if (toolName === 'TaskUpdate') {
            taskGraph.onUpdated(event);
          }
        }
        break;

      case 'Notification':
        // Idle signal when notification type indicates waiting
        if (event.agent) {
          agentTracker.onIdle(event);
        }
        break;

      case 'Stop':
      case 'SessionEnd':
        // Mark all active agents as complete
        for (const agent of agentTracker.getActive()) {
          agentTracker.onComplete({
            ...event,
            agent: { name: agent.name, tier: agent.tier as never, role: '', parentAgent: agent.parentAgent },
            statusProtocol: null,
          });
        }
        break;

      default:
        // Unknown event types are counted but not routed
        break;
    }
  }

  function getCurrentStep(): string {
    const active = agentTracker.getActive();
    if (active.length === 0) return 'unknown';

    // Return the LATEST phase among all active agents (not first match)
    let maxIdx = -1;
    let maxStep = 'unknown';
    for (const agent of active) {
      const base = agent.name.replace(/-[a-zA-Z0-9]{1,}$/, '').toLowerCase();
      const step = AGENT_PHASE_MAP[base];
      if (step) {
        const idx = WORKFLOW_PHASES.indexOf(step as typeof WORKFLOW_PHASES[number]);
        if (idx > maxIdx) {
          maxIdx = idx;
          maxStep = step;
        }
      }
    }

    return maxStep;
  }

  function getSnapshot(): OrchestrationState {
    return {
      sessionId,
      currentStep: getCurrentStep(),
      agents: agentTracker.getAll(),
      tasks: taskGraph.getAll(),
      plan: planBinder.getExecution(),
      eventCount,
      startTime,
      lastEventTime,
      fileAttention: fileAttentionMap,
      conversations,
    };
  }

  function rebuild(events: OrchEvent[]): void {
    // Replay all events through the normal processEvent path.
    // Reset counters first to avoid double-counting.
    sessionId = null;
    eventCount = 0;
    startTime = Date.now();
    lastEventTime = Date.now();
    // Clear fileAttentionMap
    for (const key of Object.keys(fileAttentionMap)) delete fileAttentionMap[key];
    // Clear conversations
    for (const key of Object.keys(conversations)) delete conversations[key];

    for (const event of events) {
      processEvent(event);
    }
  }

  // routeToSubmodules removed — rebuild() now uses processEvent() directly

  return { processEvent, getSnapshot, rebuild, getCurrentStep };
}
