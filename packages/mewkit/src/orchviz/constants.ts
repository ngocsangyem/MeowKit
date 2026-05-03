/**
 * Shared constants for the orchviz module.
 *
 * Ported (in part) from patoles/agent-flow @ 59ccf4e
 *   Original: extension/src/constants.ts
 *   License:  Apache-2.0 (see ../../NOTICE)
 *
 * Modifications: dropped VS Code/webview/dev-server constants, color tokens,
 * and hook-server constants; only timing/sizing/display values retained.
 */

import { stripAnsi } from "./parser/strip-ansi.js";

// ─── Timing ──────────────────────────────────────────────────────────────────

export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
export const SCAN_INTERVAL_MS = 1000;
export const POLL_FALLBACK_MS = 3000;
export const PERMISSION_DETECT_MS = 5000;
export const ACTIVE_SESSION_AGE_S = 10 * 60;

// ─── Sizing limits ───────────────────────────────────────────────────────────

export const PREVIEW_MAX = 60;
export const ARGS_MAX = 80;
export const RESULT_MAX = 200;
export const MESSAGE_MAX = 2000;
export const SESSION_LABEL_MAX = 14;
export const SESSION_LABEL_TRUNCATED = SESSION_LABEL_MAX - 2;
export const DISCOVERY_LABEL_MAX = 40;
export const DISCOVERY_LABEL_TAIL = DISCOVERY_LABEL_MAX - 3;
export const DISCOVERY_CONTENT_MAX = 100;
export const TASK_MAX = 60;
export const EDIT_CONTENT_MAX = 500;
export const WEB_FETCH_PROMPT_MAX = 200;
export const CHILD_NAME_MAX = 30;
export const SKILL_NAME_MAX = 40;
export const URL_PATH_MAX = 40;
export const SESSION_ID_DISPLAY = 8;
export const FAILED_RESULT_MAX = 100;
export const HASH_PREFIX_MAX = 200;
export const WORKSPACE_HASH_LENGTH = 16;

// ─── Token estimation ───────────────────────────────────────────────────────

export const CHARS_PER_TOKEN = 4;
export const MIN_TOKEN_ESTIMATE = 10;
export const FALLBACK_TOKEN_ESTIMATE = 200;
export const GREP_TOKEN_MULTIPLIER = 0.5;
export const DEFAULT_TOKEN_MULTIPLIER = 0.3;
export const SYSTEM_PROMPT_BASE_TOKENS = 5000;

// ─── Display strings ────────────────────────────────────────────────────────

export const ORCHESTRATOR_NAME = "orchestrator";

export const FILE_TOOLS = ["Read", "Edit", "Write", "Glob", "Grep"] as const;
export const PATTERN_TOOLS = ["Glob", "Grep"] as const;

export const SUBAGENT_ID_SUFFIX_LENGTH = 6;

export function generateSubagentFallbackName(id: string, index: number): string {
	return `subagent-${id.length > SUBAGENT_ID_SUFFIX_LENGTH ? id.slice(-SUBAGENT_ID_SUFFIX_LENGTH) : index}`;
}

function normalizeNameField(value: unknown): string {
	if (typeof value !== "string") return "";
	return stripAnsi(value).replace(/[\r\n\t]+/g, " ").trim();
}

/**
 * Resolve a stable display label for a Task/Agent spawn.
 *
 * Probe order: description → subagent_type → agentType (sidecar shape) → prompt → fallback.
 * `prompt`-derived names enter the SSE event stream; redact.ts only scrubs sk-/ghp_/AKIA/PEM
 * prefixes — lexical credential markers (password=, token=) pass through. Localhost-only
 * server makes this low-severity but worth knowing during review.
 */
export function resolveSubagentChildName(
	input: Record<string, unknown>,
	toolUseId?: string,
): string {
	const desc = normalizeNameField(input.description);
	const subType = normalizeNameField(input.subagent_type);
	const agentType = normalizeNameField(input.agentType);
	const prompt = normalizeNameField(input.prompt).slice(0, CHILD_NAME_MAX);
	const base = desc || subType || agentType || prompt || "subagent";
	const name = base.slice(0, CHILD_NAME_MAX);
	if (
		name === "subagent" &&
		typeof toolUseId === "string" &&
		toolUseId.length > SUBAGENT_ID_SUFFIX_LENGTH
	) {
		return `subagent-${toolUseId.slice(-SUBAGENT_ID_SUFFIX_LENGTH)}`;
	}
	return name;
}

// ─── Pause detection ────────────────────────────────────────────────────────

/** Maximum bytes for detail.plan preview (truncated server-side). */
export const PLAN_PREVIEW_MAX = 2048;
/** Hard cap for permission_request heuristic; emit pause_cleared even without tool_result. */
export const PERMISSION_HEURISTIC_MAX_MS = 60_000;
/**
 * Minimum pause duration to surface in the UI (debounce — used by sse-handler in phase-06).
 * Do NOT redeclare locally in phase-06; import from here.
 */
export const PAUSE_MIN_DURATION_MS = 200;
/** Safety cap for hook_blocked pause; parser cleanup clears after this. */
export const HOOK_BLOCKED_MAX_MS = 300_000;

// ─── HTTP/SSE server ────────────────────────────────────────────────────────

export const BIND_HOST = "127.0.0.1";
export const MAX_SSE_BUFFER = 200;
export const SSE_HEARTBEAT_MS = 30_000;
export const MAX_SSE_CLIENTS = 50;
export const SSE_DRAIN_GRACE_MS = 5_000;

export const SYSTEM_CONTENT_PREFIXES = [
	"This session is being continued",
	"<ide_",
	"<system-reminder",
	"<available-deferred-tools",
	"<command-name",
] as const;
