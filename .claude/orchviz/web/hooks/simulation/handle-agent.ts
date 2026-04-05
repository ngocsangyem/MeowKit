/**
 * OrchViz — Agent Event Handlers
 *
 * Mutates simulation state in response to agent lifecycle events.
 * Called by process-event dispatcher.
 */

import type { Particle, VisualEffect } from '@/lib/orch-types';
import { NODE, PARTICLE } from '@/lib/canvas-constants';
import { tierColor } from '@/lib/colors';
import type { OrchSimulationState, OrchEvent } from './types';

export function handleAgentSpawn(state: OrchSimulationState, event: OrchEvent): void {
  const { name, tier } = event.agent ?? { name: 'unknown', tier: 'support' };
  if (state.agents[name]) return;

  const parent = Object.values(state.agents).find(a => a.tier === 'orchestrator') ?? null;
  const parentName = parent?.name ?? null;
  const angle = Math.random() * Math.PI * 2;
  const x = (parent?.x ?? 600) + Math.cos(angle) * NODE.spawnDistance;
  const y = (parent?.y ?? 400) + Math.sin(angle) * NODE.spawnDistance;

  state.agents[name] = {
    name, tier, parentAgent: parentName, status: 'active', x, y, vx: 0, vy: 0,
    radius: tier === 'orchestrator' ? NODE.radiusMain : NODE.radiusSub,
    opacity: 0, scale: 0, breathePhase: Math.random() * Math.PI * 2, scanlineY: 0,
    currentTool: null, toolCallCount: 0, tokensUsed: 0, tokensMax: 200_000,
    cost: 0, spawnTime: Date.now(), completeTime: null, messageBubbles: [],
  };

  // Edge to parent
  if (parentName) {
    state.edges.push({ source: parentName, target: name, active: true, opacity: 0.6 });
  }

  // Spawn visual effect
  const effect: VisualEffect = {
    type: 'spawn',
    x,
    y,
    startTime: Date.now() / 1000,  // seconds — matches canvas time
    duration: 0.8,                  // seconds (was 800ms)
    color: tierColor(tier),
  };
  state.effects.push(effect);

  // Dispatch particle from parent → new agent
  if (parentName) {
    const edgeIdx = state.edges.length - 1;
    const particle: Particle = {
      edgeIdx,
      t: 0,
      speed: PARTICLE.baseSpeed,
      size: PARTICLE.baseSize,
      color: tierColor(tier),
      phase: Math.random() * Math.PI * 2,
      dir: 1,
    };
    state.particles.push(particle);
  }
}

export function handleAgentComplete(state: OrchSimulationState, event: OrchEvent): void {
  const name = event.agent?.name;
  if (!name || !state.agents[name]) return;

  function completeRecursive(agentName: string): void {
    const agent = state.agents[agentName];
    if (!agent || agent.status === 'complete') return;
    agent.status = 'complete';
    agent.completeTime = Date.now();

    // Complete effect
    state.effects.push({
      type: 'complete',
      x: agent.x,
      y: agent.y,
      startTime: Date.now() / 1000,  // seconds
      duration: 1.0,                  // seconds
      color: tierColor(agent.tier),
    });

    // Recursively complete children
    Object.values(state.agents)
      .filter(a => a.parentAgent === agentName)
      .forEach(child => completeRecursive(child.name));
  }

  completeRecursive(name);

  // Deactivate edges to/from this agent
  state.edges.forEach(e => {
    if (e.source === name || e.target === name) e.active = false;
  });
}

export function handleAgentIdle(state: OrchSimulationState, event: OrchEvent): void {
  const name = event.agent?.name;
  if (!name || !state.agents[name]) return;
  state.agents[name].status = 'thinking';
  state.agents[name].currentTool = null;
}
