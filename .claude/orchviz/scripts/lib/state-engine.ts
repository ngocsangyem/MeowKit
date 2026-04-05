/**
 * OrchViz — Orchestration State Engine
 *
 * Main state machine composing agent-tracker, task-graph, and plan-binder.
 * Processes enriched OrchEvents and maintains a live projection of orchestration state.
 */

import { AGENT_PHASE_MAP } from '../../src/orch-model.js';
import type { OrchEvent } from '../../src/protocol.js';
import { createAgentTracker, type AgentState } from './agent-tracker.js';
import { createTaskGraph, type TaskState } from './task-graph.js';
import { createPlanBinder, type PlanExecution } from './plan-binder.js';

export interface OrchestrationState {
  sessionId: string | null;
  currentStep: string;
  agents: Record<string, AgentState>;
  tasks: Record<string, TaskState>;
  plan: PlanExecution | null;
  eventCount: number;
  startTime: number;
  lastEventTime: number;
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

  function processEvent(event: OrchEvent): void {
    eventCount++;
    lastEventTime = event.timestamp;

    if (!sessionId && event.sessionId) {
      sessionId = event.sessionId;
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

    // Find the most specific (deepest) workflow step among active agents
    for (const agent of active) {
      const step = AGENT_PHASE_MAP[agent.name.replace(/-[a-f0-9]{4,}$/i, '').toLowerCase()];
      if (step) return step;
    }

    return active[0]?.workflowStep ?? 'unknown';
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
    };
  }

  function rebuild(events: OrchEvent[]): void {
    // Reset state before replaying
    const fresh = createStateEngine(plansDir);
    for (const event of events) {
      fresh.processEvent(event);
    }
    // Copy rebuilt state into this engine
    const rebuilt = fresh.getSnapshot();
    sessionId = rebuilt.sessionId;
    eventCount = rebuilt.eventCount;
    startTime = rebuilt.startTime;
    lastEventTime = rebuilt.lastEventTime;

    // Replay into own sub-modules
    for (const event of events) {
      // Use direct routing without touching counters again
      routeToSubmodules(event);
    }
  }

  function routeToSubmodules(event: OrchEvent): void {
    switch (event.eventType) {
      case 'SubagentStart':
        agentTracker.onSpawn(event);
        if (event.planContext) {
          planBinder.bindAgent(event.agent?.name ?? 'unknown', event.planContext.phaseId);
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
        if (event.taskContext) {
          const toolName = event.toolContext?.name ?? '';
          if (toolName === 'TaskCreate') taskGraph.onCreated(event);
          else if (toolName === 'TaskUpdate') taskGraph.onUpdated(event);
        }
        break;
    }
  }

  return { processEvent, getSnapshot, rebuild, getCurrentStep };
}
