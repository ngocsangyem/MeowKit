/**
 * OrchViz — Event Enricher
 *
 * Transforms raw Claude Code hook payloads into orchestration-aware
 * OrchEvents with agent tier, workflow step, plan context, and task correlation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  classifyTier,
  inferWorkflowStep,
  buildAgentInfo,
  type AgentInfo,
  type StatusProtocol,
  STATUS_PROTOCOLS,
} from './orch-model.js';
import type {
  OrchEvent,
  HookPayload,
  PlanContext,
  TaskContext,
  ToolContext,
  FileAttention,
} from './protocol.js';
import {
  PAYLOAD_ALLOWLIST,
  TASK_TOOL_NAMES,
  PLAN_CACHE_REFRESH_MS,
  RESULT_MAX,
  ARGS_MAX,
} from './constants.js';
import { estimateTokens } from './context-tracker.js';
import { log } from './logger.js';
import {
  createContextBreakdown,
  addToolResultTokens,
  addReasoningTokens,
  addSubagentResultTokens,
  snapshotBreakdown,
  type ContextBreakdown,
} from './context-tracker.js';

// ── Enricher State ──

export interface EnricherState {
  /** Monotonic sequence counter */
  seq: number;
  /** Cached plan phases (refreshed periodically) */
  planCache: PlanPhaseCache | null;
  /** Last plan cache refresh timestamp */
  planCacheRefreshedAt: number;
  /** Plans directory path */
  plansDir: string | null;
  /** Known agents (name → AgentInfo) */
  agents: Map<string, AgentInfo>;
  /** Last active agent per session — for tool event attribution */
  activeAgent: Map<string, AgentInfo>;
  /** Token breakdown per agent name */
  contextBreakdowns: Map<string, ContextBreakdown>;
  /** Seen tool_use_ids per session — cross-source dedup */
  seenToolUseIds: Map<string, Set<string>>;
}

interface PlanPhaseCache {
  planId: string;
  phases: Array<{
    id: string;
    title: string;
    status: string;
  }>;
}

// ── Factory ──

export function createEnricherState(plansDir: string | null): EnricherState {
  return {
    seq: 0,
    planCache: null,
    planCacheRefreshedAt: 0,
    plansDir,
    agents: new Map(),
    activeAgent: new Map(),
    contextBreakdowns: new Map(),
    seenToolUseIds: new Map(),
  };
}

// ── Main Enrichment ──

export function enrich(
  payload: HookPayload,
  state: EnricherState,
): OrchEvent {
  const now = Date.now();
  state.seq++;

  // Cross-source deduplication: skip events with already-seen tool_use_id
  if (payload.tool_use_id) {
    const sessionId = payload.session_id;
    let seen = state.seenToolUseIds.get(sessionId);
    if (!seen) {
      seen = new Set();
      state.seenToolUseIds.set(sessionId, seen);
    }
    const hookName = payload.hook_event_name;
    // Dedup key combines tool_use_id + hook_event_name (PreToolUse and PostToolUse have same id)
    const dedupKey = `${hookName}:${payload.tool_use_id}`;
    if (seen.has(dedupKey)) {
      // Return minimal marker event — caller checks eventType === 'duplicate' and skips broadcast
      return {
        seq: state.seq,
        timestamp: now,
        sessionId,
        eventType: 'duplicate',
        redactedPayload: {},
        agent: null,
        workflowStep: 'unknown',
        planContext: null,
        taskContext: null,
        toolContext: null,
        statusProtocol: null,
        contextBreakdown: null,
        fileAttention: null,
      };
    }
    seen.add(dedupKey);
  }

  const event: OrchEvent = {
    seq: state.seq,
    timestamp: now,
    sessionId: payload.session_id,
    eventType: payload.hook_event_name,
    redactedPayload: redactPayload(payload),
    agent: null,
    workflowStep: 'unknown',
    planContext: null,
    taskContext: null,
    toolContext: null,
    statusProtocol: null,
    contextBreakdown: null,
    fileAttention: null,
  };

  // 1. Classify agent
  event.agent = resolveAgent(payload, state);

  // 2. Infer workflow step (M3: use agent_type from payload, not constructed name)
  if (payload.agent_type) {
    event.workflowStep = inferWorkflowStep(payload.agent_type);
  } else if (event.agent) {
    event.workflowStep = inferWorkflowStep(event.agent.name);
  }

  // 3. Bind plan phase (cached, refreshed periodically)
  if (state.plansDir && now - state.planCacheRefreshedAt > PLAN_CACHE_REFRESH_MS) {
    state.planCache = refreshPlanCache(state.plansDir);
    state.planCacheRefreshedAt = now;
  }
  event.planContext = bindPlanPhase(event, state.planCache);

  // 4. Extract task context from PostToolUse(TaskCreate/TaskUpdate) (RT-1)
  if (payload.hook_event_name === 'PostToolUse' && payload.tool_name) {
    if ((TASK_TOOL_NAMES as readonly string[]).includes(payload.tool_name)) {
      event.taskContext = extractTaskContext(payload);
    }
  }

  // 5. Extract tool context + file attention
  if (payload.tool_name) {
    event.toolContext = extractToolContext(payload);
    event.fileAttention = extractFileAttention(payload);
  }

  // 6. Detect status protocol on SubagentStop
  if (payload.hook_event_name === 'SubagentStop') {
    event.statusProtocol = detectStatusProtocol(payload);
  }

  // 7. Update context breakdown for the active agent
  const agentName = event.agent?.name ?? null;
  if (agentName) {
    if (!state.contextBreakdowns.has(agentName)) {
      state.contextBreakdowns.set(agentName, createContextBreakdown());
    }
    const breakdown = state.contextBreakdowns.get(agentName)!;

    if (payload.hook_event_name === 'PostToolUse' && event.toolContext?.tokenCost) {
      addToolResultTokens(breakdown, event.toolContext.tokenCost);
    }

    if (payload.hook_event_name === 'SubagentStop' && payload.tool_response) {
      const text = typeof payload.tool_response === 'string'
        ? payload.tool_response
        : JSON.stringify(payload.tool_response);
      addSubagentResultTokens(breakdown, text);
    }

    if (payload.hook_event_name === 'Message' && payload.message) {
      addReasoningTokens(breakdown, payload.message);
    }

    event.contextBreakdown = snapshotBreakdown(breakdown);
  }

  // 8. Clean up per-session state on session end
  if (payload.hook_event_name === 'Stop' || payload.hook_event_name === 'SessionEnd') {
    state.seenToolUseIds.delete(payload.session_id);
    state.activeAgent.delete(payload.session_id);
    // contextBreakdowns kept (may be needed for final snapshot)
  }

  return event;
}

// ── Agent Resolution ──

function resolveAgent(
  payload: HookPayload,
  state: EnricherState,
): AgentInfo | null {
  const sessionId = payload.session_id;

  // SubagentStart/Stop carry agent_type — track as active agent for this session
  if (payload.agent_type) {
    let info = buildAgentInfo(
      payload.agent_type,
      payload.agent_id ?? null,
      null, // parent resolved later from transcript context
    );

    // Augment with .meta.json name if transcript path is available (best-effort)
    if (payload.agent_transcript_path) {
      const metaPath = payload.agent_transcript_path.replace(/\.jsonl$/, '.meta.json');
      try {
        const metaContent = fs.readFileSync(metaPath, 'utf-8');
        const meta = JSON.parse(metaContent) as Record<string, unknown>;
        const metaName = String(meta.description ?? meta.subagent_type ?? '').trim();
        if (metaName && metaName !== 'subagent') {
          info = buildAgentInfo(metaName, payload.agent_id ?? null, null);
        }
      } catch { /* meta file may not exist */ }
    }

    state.agents.set(info.name, info);

    // Track active agent per session for tool attribution
    if (payload.hook_event_name === 'SubagentStart') {
      state.activeAgent.set(sessionId, info);
    }
    return info;
  }

  // PreToolUse/PostToolUse: attribute to last active agent in this session
  return state.activeAgent.get(sessionId) ?? null;
}

// ── Payload Redaction (RT-14) ──

function redactPayload(payload: HookPayload): Record<string, unknown> {
  const eventName = payload.hook_event_name;
  const allowlist = PAYLOAD_ALLOWLIST[eventName];

  if (!allowlist) {
    // Unknown event type — keep only session_id and event name
    return {
      session_id: payload.session_id,
      hook_event_name: eventName,
    };
  }

  const redacted: Record<string, unknown> = {};
  for (const key of allowlist) {
    if (key in payload) {
      redacted[key] = (payload as unknown as Record<string, unknown>)[key];
    }
  }
  return redacted;
}

// ── Task Extraction from PostToolUse (RT-1) ──

export function extractTaskContext(payload: HookPayload): TaskContext | null {
  try {
    const toolInput = payload.tool_input;
    const toolResponse = payload.tool_response;

    if (!toolInput) return null;

    // TaskCreate: tool_input has { subject, description, blockedBy }
    // tool_response has the created task ID
    const subject = (toolInput.subject as string) ?? '';
    const description = (toolInput.description as string) ?? '';
    const blockedBy = Array.isArray(toolInput.addBlockedBy)
      ? (toolInput.addBlockedBy as string[])
      : [];

    // Parse task ID from response
    let taskId = 'unknown';
    if (typeof toolResponse === 'string') {
      const match = toolResponse.match(/Task #(\d+)/i);
      if (match) taskId = match[1];
    } else if (toolResponse && typeof toolResponse === 'object') {
      const content =
        'content' in toolResponse ? String(toolResponse.content) : '';
      const match = content.match(/Task #(\d+)/i);
      if (match) taskId = match[1];
    }

    return {
      taskId,
      subject: subject.slice(0, ARGS_MAX),
      owner: null, // set by state engine when agent claims task
      status: payload.tool_name === 'TaskCreate' ? 'pending' : 'updated',
      blockedBy,
    };
  } catch (err) {
    log.warn('Failed to extract task context:', err);
    return null;
  }
}

// ── Tool Context Extraction ──

function extractToolContext(payload: HookPayload): ToolContext | null {
  if (!payload.tool_name) return null;

  const filePath =
    (payload.tool_input?.file_path as string) ??
    (payload.tool_input?.path as string) ??
    null;

  // Token cost estimated from response length (rough heuristic)
  let tokenCost: number | null = null;
  if (payload.tool_response) {
    const responseStr =
      typeof payload.tool_response === 'string'
        ? payload.tool_response
        : JSON.stringify(payload.tool_response);
    tokenCost = estimateTokens(responseStr);
  }

  return {
    name: payload.tool_name,
    filePath,
    duration: null, // computed by state engine from start→end
    tokenCost,
    isError: false, // set by PostToolUseFailure handler
  };
}

// ── File Attention Extraction ──

/** Map tool names to file attention operations. */
const FILE_OP_MAP: Record<string, FileAttention['operation']> = {
  Read: 'read',
  Glob: 'read',
  Grep: 'read',
  Write: 'write',
  Edit: 'edit',
  WebSearch: 'search',
  WebFetch: 'search',
};

/**
 * Extract all file paths referenced in a tool call and classify the operation.
 * Returns null if the tool does not interact with files.
 */
export function extractFileAttention(payload: HookPayload): FileAttention[] | null {
  if (!payload.tool_name) return null;

  const operation = FILE_OP_MAP[payload.tool_name];
  if (!operation) return null;

  const input = payload.tool_input ?? {};
  const candidates: string[] = [];

  // Collect all path-like fields — order matters: most specific first
  for (const field of ['file_path', 'path', 'pattern', 'glob'] as const) {
    const val = input[field];
    if (typeof val === 'string' && val.trim()) {
      candidates.push(val.trim());
    }
  }

  if (candidates.length === 0) return null;

  // Token cost shared across all referenced files for this event
  let tokenCost = 0;
  if (payload.tool_response) {
    const responseStr = typeof payload.tool_response === 'string'
      ? payload.tool_response
      : JSON.stringify(payload.tool_response);
    tokenCost = estimateTokens(responseStr);
  }

  return candidates.map((p) => ({ path: p, operation, tokenCost }));
}

// ── Plan Phase Binding ──

export function refreshPlanCache(plansDir: string): PlanPhaseCache | null {
  try {
    // Find the most recent plan directory
    if (!fs.existsSync(plansDir)) return null;

    const entries = fs.readdirSync(plansDir, { withFileTypes: true });
    const planDirs = entries
      .filter((e) => e.isDirectory() && /^\d{6}-/.test(e.name))
      .sort((a, b) => b.name.localeCompare(a.name)); // newest first

    if (planDirs.length === 0) return null;

    const planDir = path.join(plansDir, planDirs[0].name);
    const planFile = path.join(planDir, 'plan.md');
    if (!fs.existsSync(planFile)) return null;

    // Parse phase files
    const phaseFiles = fs
      .readdirSync(planDir)
      .filter((f) => /^phase-\d+/.test(f) && f.endsWith('.md'))
      .sort();

    const phases = phaseFiles.map((f) => {
      const content = fs.readFileSync(path.join(planDir, f), 'utf-8');
      const frontmatter = parseFrontmatter(content);
      return {
        id: f.replace('.md', ''),
        title: (frontmatter.title as string) ?? f,
        status: (frontmatter.status as string) ?? 'pending',
      };
    });

    return { planId: planDirs[0].name, phases };
  } catch (err) {
    log.warn('Failed to refresh plan cache:', err);
    return null;
  }
}

/** Simple frontmatter parser (avoids gray-matter dependency in hot path) */
function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      result[key] = val;
    }
  }
  return result;
}

function bindPlanPhase(
  event: OrchEvent,
  cache: PlanPhaseCache | null,
): PlanContext | null {
  if (!cache || cache.phases.length === 0) return null;

  // Find first in-progress phase
  const activePhase = cache.phases.find(
    (p) => p.status === 'in_progress' || p.status === 'active',
  );
  if (!activePhase) return null;

  return {
    planId: cache.planId,
    phaseId: activePhase.id,
    phaseTitle: activePhase.title,
    phaseStatus: activePhase.status,
  };
}

// ── Status Protocol Detection ──

function detectStatusProtocol(payload: HookPayload): StatusProtocol | null {
  // Status protocol is typically in the last message of the subagent's response
  const response = payload.tool_response;
  if (!response) return null;

  const text =
    typeof response === 'string' ? response : JSON.stringify(response);

  // Look for "**Status:** DONE" pattern from orchestration-protocol.md
  for (const status of STATUS_PROTOCOLS) {
    if (text.includes(`Status:** ${status}`) || text.includes(`Status: ${status}`)) {
      return status;
    }
  }
  return null;
}
