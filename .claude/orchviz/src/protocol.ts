/**
 * OrchViz — Event Protocol
 *
 * OrchEvent extends Agent Flow's AgentEvent concept with
 * orchestration-specific enrichment fields.
 */

import type { AgentInfo, WorkflowStep, StatusProtocol } from './orch-model.js';
import type { ContextBreakdown } from './context-tracker.js';

// ── Base Agent Event (mirrors Agent Flow protocol.ts) ──

export type AgentEventType =
  | 'agent_spawn'
  | 'agent_complete'
  | 'agent_idle'
  | 'model_detected'
  | 'tool_call_start'
  | 'tool_call_end'
  | 'message'
  | 'context_update'
  | 'subagent_dispatch'
  | 'subagent_return'
  | 'permission_requested'
  | 'error';

// ── Plan Context ──

export interface PlanContext {
  planId: string;
  phaseId: string;
  phaseTitle: string;
  phaseStatus: string;
}

// ── Task Context (inferred from PostToolUse of TaskCreate/TaskUpdate) ──

export interface TaskContext {
  taskId: string;
  subject: string;
  owner: string | null;
  status: string;
  blockedBy: string[];
}

// ── Tool Context ──

export interface ToolContext {
  name: string;
  filePath: string | null;
  duration: number | null;
  tokenCost: number | null;
  isError: boolean;
}

// ── File Attention ──

export interface FileAttention {
  path: string;
  operation: 'read' | 'write' | 'edit' | 'search';
  tokenCost: number;
}

// Re-export for consumers that import from protocol only
export type { ContextBreakdown } from './context-tracker.js';

// ── Orchestration Event (enriched) ──

export interface OrchEvent {
  /** Monotonic sequence number for dedup on SSE reconnect (RT2-5) */
  seq: number;
  /** Unix ms timestamp */
  timestamp: number;
  /** Session identifier */
  sessionId: string;
  /** Original hook event name */
  eventType: string;
  /** Redacted payload — metadata only per allowlist (RT-14) */
  redactedPayload: Record<string, unknown>;
  /** Enriched agent info (tier, role, parent) */
  agent: AgentInfo | null;
  /** Inferred workflow step */
  workflowStep: WorkflowStep;
  /** Bound plan phase (if plan directory available) */
  planContext: PlanContext | null;
  /** Correlated task (if event is TaskCreate/TaskUpdate tool call) */
  taskContext: TaskContext | null;
  /** Tool call metadata */
  toolContext: ToolContext | null;
  /** Status protocol on agent completion */
  statusProtocol: StatusProtocol | null;
  /** Token usage breakdown by category for the active agent at event time */
  contextBreakdown: ContextBreakdown | null;
  /** Files accessed during this event */
  fileAttention: FileAttention[] | null;
}

// ── Hook Payload (raw from Claude Code) ──

export interface HookPayload {
  session_id: string;
  hook_event_name: string;
  transcript_path?: string;
  cwd?: string;
  // PreToolUse / PostToolUse
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
  tool_response?: string | Record<string, unknown>;
  // SubagentStart / SubagentStop
  agent_id?: string;
  agent_type?: string;
  agent_transcript_path?: string;
  // Notification
  notification_type?: string;
  message?: string;
}

// ── SSE Message Types ──

export type SSEMessage =
  | { type: 'orch-event'; event: OrchEvent }
  | { type: 'event-batch'; events: OrchEvent[] }
  | { type: 'state-snapshot'; state: Record<string, unknown> }
  | { type: 'session-start'; sessionId: string; label: string }
  | { type: 'session-end'; sessionId: string };

// ── Enricher Delegate (decouples enrichment from transport) ──

export interface EnricherDelegate {
  emit(event: OrchEvent): void;
  getSessionStartTime(sessionId: string): number | undefined;
}
