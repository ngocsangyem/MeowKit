'use strict';
// hook-payload.cjs — one reading of a hook's stdin payload, whichever runtime sent it.
//
// The hooks registered in `.claude/settings.json` are also run by runtimes that import
// that file, and those send their own key spelling: Claude Code and Codex write
// `tool_input`, `tool_name`, `session_id`, `hook_event_name`; Grok writes `toolInput`,
// `toolName`, `sessionId`, `hookEventName` (docs.x.ai/build/features/hooks, "The script
// contract"). A guard that knew one spelling would read the other as an empty payload and
// allow the call. Only the spelling is folded here: no key is guessed from a different
// name, and what each decision does with the fields is unchanged.

/** Each field, and the keys it is read from, first match wins. */
const KEYS = {
  tool_input: ['tool_input', 'toolInput'],
  tool_name: ['tool_name', 'toolName'],
  session_id: ['session_id', 'sessionId'],
  hook_event_name: ['hook_event_name', 'hookEventName'],
  transcript_path: ['transcript_path', 'transcriptPath'],
  cwd: ['cwd', 'workspaceRoot'],
};
const INPUT_KEYS = {
  file_path: ['file_path', 'filePath'],
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function fold(source, keys) {
  const out = { ...source };
  for (const [name, spellings] of Object.entries(keys)) {
    if (out[name] !== undefined && out[name] !== null) continue;
    const found = spellings.find((key) => source[key] !== undefined && source[key] !== null);
    if (found) out[name] = source[found];
  }
  return out;
}

/**
 * `data` with the snake_case keys every hook here reads filled in from the camelCase
 * ones. The sender's own keys stay as they came; anything that is not an object is
 * returned as it is.
 */
function canonicalPayload(data) {
  if (!isObject(data)) return data;
  const out = fold(data, KEYS);
  if (isObject(out.tool_input)) out.tool_input = fold(out.tool_input, INPUT_KEYS);
  // An event name is the same event with either first letter: `preToolUse`, `PreToolUse`.
  if (typeof out.hook_event_name === 'string' && out.hook_event_name) {
    out.hook_event_name = out.hook_event_name[0].toUpperCase() + out.hook_event_name.slice(1);
  }
  return out;
}

module.exports = { canonicalPayload };
