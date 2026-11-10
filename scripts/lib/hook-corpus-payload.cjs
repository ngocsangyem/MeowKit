'use strict';
// hook-corpus-payload.cjs — the stdin payloads the BASE hooks receive.
//
// Shape matches what lib/parse-stdin.cjs parses: a single JSON object with
// `tool_name`, `tool_input.file_path` / `tool_input.command`, `session_id`,
// `cwd` and `hook_event_name`. `{{TMP}}` is replaced with the throwaway project
// path at run time and kept as the placeholder in the written fixture.

const PROJECT_DIR_ENV = { CLAUDE_PROJECT_DIR: '{{TMP}}' };

/** Shared constants so every case group names the same plan, slug and contract. */
const SLUG = 'corpus-demo';
const PLAN_DIR = `tasks/plans/261101-${SLUG}`;
const PLAN = `${PLAN_DIR}/plan.md`;
const CONTRACT = `tasks/contracts/261101-${SLUG}-sprint-1.md`;

function payload(fields) {
  return `${JSON.stringify({ session_id: 'corpus-session', cwd: '{{TMP}}', ...fields })}\n`;
}

/** A tool-scoped PreToolUse/PostToolUse payload. */
function toolPayload(toolName, input, event = 'PreToolUse') {
  return payload({ hook_event_name: event, tool_name: toolName, tool_input: input });
}

const edit = (filePath) => toolPayload('Edit', { file_path: filePath });
const write = (filePath) => toolPayload('Write', { file_path: filePath });
const read = (filePath) => toolPayload('Read', { file_path: filePath });
const bash = (command) => toolPayload('Bash', { command });
const postEdit = (filePath) => toolPayload('Edit', { file_path: filePath }, 'PostToolUse');
const stopEvent = () => payload({ hook_event_name: 'Stop' });

module.exports = {
  CONTRACT,
  PLAN,
  PLAN_DIR,
  PROJECT_DIR_ENV,
  SLUG,
  bash,
  edit,
  payload,
  postEdit,
  read,
  stopEvent,
  toolPayload,
  write,
};
