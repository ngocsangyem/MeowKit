/**
 * OrchViz — Tool Call Event Handlers
 *
 * Extracted from process-event to keep files under 100 lines.
 * Handles PreToolUse / PostToolUse mutations on state.
 */

import type { ToolCallNode, Particle } from '@/lib/orch-types';
import { PARTICLE } from '@/lib/canvas-constants';
import { tierColor } from '@/lib/colors';
import type { OrchSimulationState, OrchEvent } from './types';

function dispatchEdgeParticle(state: OrchSimulationState, agentName: string, dir: 1 | -1, speedMul = 1): void {
  const agent = state.agents[agentName];
  if (!agent?.parentAgent) return;
  const edgeIdx = state.edges.findIndex(e => e.source === agent.parentAgent && e.target === agentName);
  if (edgeIdx < 0) return;
  state.particles.push({
    edgeIdx,
    t: dir === 1 ? 0 : 1,
    speed: PARTICLE.baseSpeed * 1.5 * speedMul,
    size: PARTICLE.baseSize * (dir === 1 ? 1 : 0.8),
    color: tierColor(agent.tier),
    phase: Math.random() * Math.PI * 2,
    dir,
  });
}

export function handlePreToolUse(state: OrchSimulationState, event: OrchEvent): void {
  const agentName = event.agent?.name ?? 'unknown';
  const toolName = event.toolContext?.name ?? 'unknown';

  const toolCall: ToolCallNode = {
    id: `${agentName}-${toolName}-${event.seq}`,
    agentName,
    toolName,
    args: '',
    state: 'running',
    tokenCost: null,
    errorMessage: null,
    x: state.agents[agentName]?.x ?? 0,
    y: state.agents[agentName]?.y ?? 0,
    opacity: 1,
    startTime: event.timestamp,
    completeTime: null,
  };
  state.toolCalls.push(toolCall);
  state.toolCount++;
  // Evict old completed/error tool calls to prevent unbounded growth
  if (state.toolCalls.length > 200) {
    state.toolCalls = state.toolCalls.filter(
      tc => tc.state === 'running' || (Date.now() - (tc.completeTime ?? 0)) < 10000
    );
  }

  const agent = state.agents[agentName];
  if (agent) {
    agent.currentTool = toolName;
    agent.toolCallCount++;
    agent.status = 'active';
  }

  dispatchEdgeParticle(state, agentName, 1);
}

export function handlePostToolUse(state: OrchSimulationState, event: OrchEvent): void {
  const agentName = event.agent?.name ?? 'unknown';
  const toolName = event.toolContext?.name ?? 'unknown';
  const tokenCost = event.toolContext?.tokenCost ?? null;

  const tc = state.toolCalls.findLast(t => t.agentName === agentName && t.toolName === toolName && t.state === 'running');
  if (tc) {
    tc.state = 'complete';
    tc.tokenCost = tokenCost;
    tc.completeTime = event.timestamp;
  }

  const agent = state.agents[agentName];
  if (agent) {
    if (tokenCost) agent.tokensUsed += tokenCost;
    agent.currentTool = null;
  }

  dispatchEdgeParticle(state, agentName, -1);
}
