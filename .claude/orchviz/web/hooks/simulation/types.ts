/**
 * OrchViz — Orchestration Simulation State Types
 *
 * Core state shape for the simulation layer.
 * Consumed by hooks, process-event dispatcher, and handle-* modules.
 */

import type { AgentNode, EdgeNode, Particle, ToolCallNode, VisualEffect } from '@/lib/orch-types';
import { PERF } from '@/lib/canvas-constants';

export interface OrchSimulationState {
  agents: Record<string, AgentNode>;
  edges: EdgeNode[];
  particles: Particle[];
  toolCalls: ToolCallNode[];
  effects: VisualEffect[];
  events: OrchEvent[]; // ring buffer, max PERF.maxEventBuffer
  /** MeowKit 7-phase: orient|plan|test-red|build|review|ship|reflect|unknown */
  currentPhase: string;
  tasks: Record<string, TaskNode>;
  plan: PlanState | null;
  sessionId: string | null;
  startTime: number;
  lastEventTime: number;
  eventCount: number;
  toolCount: number;
  totalCost: number;
  lastProcessedSeq: number;
}

export interface OrchEvent {
  seq: number;
  timestamp: number;
  sessionId: string;
  eventType: string;
  agent: { name: string; tier: string } | null;
  workflowStep: string;
  toolContext: { name: string; filePath: string | null; tokenCost: number | null } | null;
  /** Task context parsed from PostToolUse of TaskCreate/TaskUpdate */
  taskContext?: { id: string; subject: string; status: string; owner: string | null; blockedBy: string[] } | null;
  /** Role and text for message events */
  messageContext?: { role: 'user' | 'assistant' | 'thinking' | 'subagent_report'; text: string } | null;
}

export interface TaskNode {
  id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  owner: string | null;
  blockedBy: string[];
}

export interface PlanState {
  phases: Array<{ id: string; title: string; status: string }>;
  overallProgress: number;
}

export function createInitialState(): OrchSimulationState {
  return {
    agents: {},
    edges: [],
    particles: [],
    toolCalls: [],
    effects: [],
    events: [],
    currentPhase: 'unknown',
    tasks: {},
    plan: null,
    sessionId: null,
    startTime: Date.now(),
    lastEventTime: 0,
    eventCount: 0,
    toolCount: 0,
    totalCost: 0,
    lastProcessedSeq: -1,
  };
}

/** Push event into ring buffer, evict oldest if over limit */
export function pushEvent(state: OrchSimulationState, event: OrchEvent): void {
  state.events.push(event);
  if (state.events.length > PERF.maxEventBuffer) {
    state.events.shift();
  }
  state.eventCount++;
  state.lastEventTime = event.timestamp;
  if (event.seq > state.lastProcessedSeq) {
    state.lastProcessedSeq = event.seq;
  }
}
