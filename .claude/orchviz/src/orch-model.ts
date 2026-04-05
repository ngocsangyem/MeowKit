/**
 * OrchViz — Orchestration Model
 *
 * Agent tier definitions, workflow phases, and agent-to-phase mapping
 * aligned with MeowKit's ACTUAL agent roster and 7-phase workflow.
 *
 * Source of truth:
 * - meowkit/CLAUDE.md (agent table, workflow phases)
 * - meowkit/.claude/agents/AGENTS_INDEX.md (Core/Support classification)
 * - meowkit/.claude/rules/gate-rules.md (Gate 1, Gate 2)
 */

// ── Agent Tiers ──
// MeowKit uses Core/Support classification. OrchViz maps this to 4 tiers
// for visualization granularity (color-coding, layout grouping).

export type AgentTier = 'orchestrator' | 'executor' | 'validator' | 'support';

/**
 * MeowKit agent names → tier classification.
 * Source: meowkit/CLAUDE.md agent table + meowkit/.claude/agents/
 */
export const AGENT_TIERS: Record<AgentTier, string[]> = {
  orchestrator: ['orchestrator'],
  executor: ['planner', 'researcher', 'developer', 'tester', 'brainstormer', 'ui-ux-designer'],
  validator: ['reviewer', 'security', 'architect'],
  support: ['documenter', 'analyst', 'shipper', 'git-manager', 'journal-writer'],
};

// Reverse lookup: agent type → tier
const AGENT_TIER_MAP = new Map<string, AgentTier>();
for (const [tier, agents] of Object.entries(AGENT_TIERS)) {
  for (const agent of agents) {
    AGENT_TIER_MAP.set(agent, tier as AgentTier);
  }
}

/** Classify an agent type string into a tier. Falls back to 'executor'. */
export function classifyTier(agentType: string): AgentTier {
  // Normalize: strip suffixes like "-a1b2" or "-abc12345" (session IDs)
  const base = agentType.replace(/-[a-f0-9]{4,}$/i, '').toLowerCase();
  return AGENT_TIER_MAP.get(base) ?? 'executor';
}

// ── Workflow Phases ──
// MeowKit's 7-phase workflow from CLAUDE.md:
//   Phase 0 Orient → Phase 1 Plan [GATE 1] → Phase 2 Test RED
//   → Phase 3 Build → Phase 4 Review [GATE 2] → Phase 5 Ship → Phase 6 Reflect

export const WORKFLOW_PHASES = [
  'orient',    // Phase 0: model tier classification, memory check
  'plan',      // Phase 1: two-lens plan, Gate 1 approval
  'test-red',  // Phase 2: write failing tests first (TDD)
  'build',     // Phase 3: TDD implementation
  'review',    // Phase 4: structural audit, security, Gate 2
  'ship',      // Phase 5: deploy pipeline
  'reflect',   // Phase 6: living docs, changelogs, cost tracking
] as const;

export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number] | 'unknown';

// Backward compat alias
export type WorkflowStep = WorkflowPhase;
export const WORKFLOW_STEPS = WORKFLOW_PHASES;

/** Gate positions in the workflow (hard stops requiring human approval) */
export const GATES = {
  gate1: { afterPhase: 'plan', beforePhase: 'test-red', label: 'Gate 1 — Plan Approval' },
  gate2: { afterPhase: 'review', beforePhase: 'ship', label: 'Gate 2 — Review Approval' },
} as const;

/**
 * MeowKit agent type → workflow phase mapping.
 * Source: meowkit/CLAUDE.md agent table "Phase" column.
 * Note: security spans phases 2 AND 4; analyst spans 0 AND 6.
 */
export const AGENT_PHASE_MAP: Record<string, WorkflowPhase> = {
  orchestrator: 'orient',
  planner: 'plan',
  architect: 'plan',
  brainstormer: 'plan',
  tester: 'test-red',
  security: 'test-red',    // also phase 4 (review) — primary assignment is test-red
  developer: 'build',
  'ui-ux-designer': 'build',
  researcher: 'plan',      // research happens during planning in MeowKit
  reviewer: 'review',
  shipper: 'ship',
  documenter: 'reflect',
  analyst: 'reflect',      // also phase 0 (orient) — primary assignment is reflect
  'git-manager': 'ship',
  'journal-writer': 'reflect',
};

// Backward compat alias
export const AGENT_STEP_MAP = AGENT_PHASE_MAP;

/** Infer workflow phase from agent type. Falls back to 'unknown'. */
export function inferWorkflowStep(agentType: string): WorkflowPhase {
  const base = agentType.replace(/-[a-f0-9]{4,}$/i, '').toLowerCase();
  return AGENT_PHASE_MAP[base] ?? 'unknown';
}

// ── Status Protocol ──
// Subagent completion status from MeowKit output-format-rules.md.

export const STATUS_PROTOCOLS = [
  'DONE', 'DONE_WITH_CONCERNS', 'BLOCKED', 'NEEDS_CONTEXT',
] as const;

export type StatusProtocol = (typeof STATUS_PROTOCOLS)[number];

// ── Agent Info (enriched agent metadata) ──

export interface AgentInfo {
  name: string;
  tier: AgentTier;
  role: string;
  parentAgent: string | null;
}

/** Human-readable role descriptions per agent (from CLAUDE.md) */
const AGENT_ROLES: Record<string, string> = {
  orchestrator: 'Route tasks, assign model tier',
  planner: 'Two-lens plan, Gate 1',
  architect: 'ADRs, system design',
  tester: 'Write failing tests first',
  developer: 'TDD implementation',
  security: 'Audit, BLOCK verdicts',
  reviewer: 'Structural audit, Gate 2',
  shipper: 'Deploy pipeline',
  documenter: 'Living docs, changelogs',
  analyst: 'Cost tracking, patterns',
  researcher: 'Technical research',
  brainstormer: 'Solution exploration',
  'ui-ux-designer': 'Interface design',
  'git-manager': 'Git operations',
  'journal-writer': 'Session learnings',
};

const TIER_ROLES: Record<AgentTier, string> = {
  orchestrator: 'Orchestrates workflow',
  executor: 'Executes tasks',
  validator: 'Validates quality',
  support: 'Supports operations',
};

/** Build AgentInfo from agent type and optional parent. */
export function buildAgentInfo(
  agentType: string,
  agentId: string | null,
  parentAgent: string | null,
): AgentInfo {
  const tier = classifyTier(agentType);
  const base = agentType.replace(/-[a-f0-9]{4,}$/i, '').toLowerCase();
  const name = agentId
    ? `${base}-${agentId.slice(-4)}`
    : base;
  const role = AGENT_ROLES[base] ?? TIER_ROLES[tier];
  return { name, tier, role, parentAgent };
}
