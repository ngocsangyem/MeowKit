/**
 * OrchViz — Plan Binder
 *
 * Binds plan phases to agent execution.
 * Uses refreshPlanCache from orch-enricher for plan discovery.
 */

import { refreshPlanCache } from '../../src/orch-enricher.js';

export interface PlanPhase {
  id: string;
  title: string;
  status: string;
}

export interface PlanExecution {
  planId: string;
  phases: PlanPhase[];
  agentBindings: Record<string, string[]>; // phaseId → agent names
  overallProgress: number;                  // 0-100
}

export interface PlanBinder {
  refresh(): void;
  bindAgent(agentName: string, phaseId: string): void;
  getExecution(): PlanExecution | null;
  getProgress(): number;
}

export function createPlanBinder(plansDir: string | null): PlanBinder {
  let execution: PlanExecution | null = null;

  function refresh(): void {
    if (!plansDir) return;

    const cache = refreshPlanCache(plansDir);
    if (!cache) {
      execution = null;
      return;
    }

    // Preserve existing agent bindings if same plan
    const existingBindings = execution?.planId === cache.planId
      ? execution.agentBindings
      : {};

    execution = {
      planId: cache.planId,
      phases: cache.phases.map((p) => ({ id: p.id, title: p.title, status: p.status })),
      agentBindings: existingBindings,
      overallProgress: computeProgress(cache.phases),
    };
  }

  function bindAgent(agentName: string, phaseId: string): void {
    if (!execution) return;

    const phase = execution.phases.find((p) => p.id === phaseId);
    if (!phase) return;

    if (!execution.agentBindings[phaseId]) {
      execution.agentBindings[phaseId] = [];
    }
    if (!execution.agentBindings[phaseId].includes(agentName)) {
      execution.agentBindings[phaseId].push(agentName);
    }
  }

  function getExecution(): PlanExecution | null {
    return execution;
  }

  function getProgress(): number {
    if (!execution) return 0;
    return computeProgress(execution.phases);
  }

  return { refresh, bindAgent, getExecution, getProgress };
}

function computeProgress(phases: PlanPhase[]): number {
  if (phases.length === 0) return 0;
  const completed = phases.filter(
    (p) => p.status === 'completed' || p.status === 'done',
  ).length;
  return Math.round((completed / phases.length) * 100);
}
