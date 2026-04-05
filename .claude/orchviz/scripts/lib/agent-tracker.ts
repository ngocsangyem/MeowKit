/**
 * OrchViz — Agent Tracker
 *
 * Manages agent lifecycle state using plain objects (not Maps) for JSON serialization.
 * Handles out-of-order events via lazy init (RT-12).
 */

import { classifyTier, inferWorkflowStep, AGENT_PHASE_MAP } from '../../src/orch-model.js';
import type { OrchEvent } from '../../src/protocol.js';

export interface AgentState {
  name: string;
  tier: string;
  status: 'spawned' | 'active' | 'idle' | 'complete';
  parentAgent: string | null;
  currentTask: string | null;
  statusProtocol: string | null;
  spawnTime: number;
  completeTime: number | null;
  toolCallCount: number;
  toolsUsed: string[];
  workflowStep: string;
}

export interface DelegationNode {
  name: string;
  children: DelegationNode[];
}

export interface AgentTracker {
  onSpawn(event: OrchEvent): void;
  onToolCallStart(event: OrchEvent): void;
  onToolCallEnd(event: OrchEvent): void;
  onComplete(event: OrchEvent): void;
  onIdle(event: OrchEvent): void;
  getActive(): AgentState[];
  getAll(): Record<string, AgentState>;
  getDelegationTree(): DelegationNode[];
  getOrCreate(name: string): AgentState;
}

export function createAgentTracker(): AgentTracker {
  const agents: Record<string, AgentState> = {};

  function getOrCreate(name: string): AgentState {
    if (!agents[name]) {
      // RT-12: lazy init for out-of-order events
      agents[name] = {
        name,
        tier: classifyTier(name),
        status: 'spawned',
        parentAgent: null,
        currentTask: null,
        statusProtocol: null,
        spawnTime: Date.now(),
        completeTime: null,
        toolCallCount: 0,
        toolsUsed: [],
        workflowStep: inferWorkflowStep(name),
      };
    }
    return agents[name];
  }

  function onSpawn(event: OrchEvent): void {
    const agentName = event.agent?.name ?? 'unknown';
    const state = getOrCreate(agentName);
    state.spawnTime = event.timestamp;
    state.status = 'spawned';
    if (event.agent?.parentAgent) {
      state.parentAgent = event.agent.parentAgent;
    }
    if (event.agent?.tier) {
      state.tier = event.agent.tier;
    }
    state.workflowStep = event.workflowStep;
  }

  function onToolCallStart(event: OrchEvent): void {
    const agentName = event.agent?.name ?? 'unknown';
    const state = getOrCreate(agentName);
    state.status = 'active';
    state.toolCallCount++;
    const toolName = event.toolContext?.name;
    if (toolName && !state.toolsUsed.includes(toolName)) {
      state.toolsUsed.push(toolName);
    }
  }

  function onToolCallEnd(_event: OrchEvent): void {
    // Duration tracked at event level — no state change needed
  }

  function onComplete(event: OrchEvent): void {
    const agentName = event.agent?.name ?? 'unknown';
    const state = getOrCreate(agentName);
    state.status = 'complete';
    state.completeTime = event.timestamp;
    if (event.statusProtocol) {
      state.statusProtocol = event.statusProtocol;
    }
  }

  function onIdle(event: OrchEvent): void {
    const agentName = event.agent?.name ?? 'unknown';
    const state = getOrCreate(agentName);
    state.status = 'idle';
  }

  function getActive(): AgentState[] {
    return Object.values(agents).filter(
      (a) => a.status === 'spawned' || a.status === 'active',
    );
  }

  function getAll(): Record<string, AgentState> {
    return agents;
  }

  function getDelegationTree(): DelegationNode[] {
    // Find roots (no parent or parent unknown)
    const roots: DelegationNode[] = [];
    const nodeMap: Record<string, DelegationNode> = {};

    for (const agent of Object.values(agents)) {
      nodeMap[agent.name] = { name: agent.name, children: [] };
    }

    for (const agent of Object.values(agents)) {
      if (agent.parentAgent && nodeMap[agent.parentAgent]) {
        nodeMap[agent.parentAgent].children.push(nodeMap[agent.name]);
      } else {
        roots.push(nodeMap[agent.name]);
      }
    }

    return roots;
  }

  return { onSpawn, onToolCallStart, onToolCallEnd, onComplete, onIdle, getActive, getAll, getDelegationTree, getOrCreate };
}
