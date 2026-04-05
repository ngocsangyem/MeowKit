/**
 * OrchViz — Shared Constants
 *
 * Timing, buffer sizes, and display limits.
 * Reuses Agent Flow values where applicable.
 */

// ── Timing (from Agent Flow constants.ts) ──
export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 min
export const SCAN_INTERVAL_MS = 1000; // 1 sec
export const POLL_FALLBACK_MS = 3000; // macOS fs.watch safety
export const PLAN_CACHE_REFRESH_MS = 30_000; // 30 sec

// ── Hook Server ──
export const HOOK_MAX_BODY_SIZE = 1024 * 1024; // 1 MB
export const HOOK_TIMEOUT_S = 2;

// ── Event Buffer ──
export const MAX_EVENT_BUFFER = 5000;

// ── Display Limits (from Agent Flow) ──
export const PREVIEW_MAX = 60;
export const ARGS_MAX = 80;
export const RESULT_MAX = 200;
export const SESSION_ID_DISPLAY = 8;
export const CHILD_NAME_MAX = 30;

// ── Server Ports ──
export const DEFAULT_PORT = 3600;
export const MAX_PORT = 3650;

// ── Event Store ──
export const STORE_DIR_NAME = 'sessions';

// ── Enricher ──
export const TASK_TOOL_NAMES = ['TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList'] as const;

// ── Redaction Allowlist (RT-14) ──
// Only these fields are kept from rawPayload per event type.
export const PAYLOAD_ALLOWLIST: Record<string, string[]> = {
  SubagentStart: ['agent_type', 'agent_id'],
  SubagentStop: ['agent_type', 'agent_id'],
  PreToolUse: ['tool_name', 'tool_use_id'],
  PostToolUse: ['tool_name', 'tool_use_id'],
  SessionStart: ['session_id', 'cwd'],
  Stop: ['session_id'],
  SessionEnd: ['session_id'],
};
