// parse-stdin.cjs — Read all stdin and parse as JSON.
// Returns a promise that resolves to the parsed object.
// Normalizes file_path in tool_input if present.

const path = require('path');

function normalizeFilePath(filePath, cwd) {
  if (!filePath) return filePath;
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(cwd || process.cwd(), filePath);
}

function parseStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        const parsed = JSON.parse(data || '{}');
        // Normalize file_path if present
        if (parsed.tool_input && parsed.tool_input.file_path) {
          parsed.tool_input.file_path = normalizeFilePath(
            parsed.tool_input.file_path,
            parsed.cwd
          );
        }
        resolve(parsed);
      } catch {
        resolve({});
      }
    });
    // Handle closed stdin (no data)
    process.stdin.on('error', () => resolve({}));
  });
}

/**
 * Read stdin for a hook that must fail closed.
 *
 * `parseStdin` above resolves `{}` for empty or malformed input, which is right
 * for an observer: a telemetry handler that cannot read its payload should get
 * out of the way. A write guard must do the opposite — unreadable input means
 * it cannot tell what is being written, and "cannot tell" is not "allow". So
 * this reader reports WHY it failed and lets the caller block.
 *
 * It also hands back the file path exactly as the payload spelled it, with no
 * resolution to an absolute path. The guards echo that value in their block
 * messages and match it against repo-relative rules, so rewriting it here would
 * change both the decision and the message the model reads back.
 *
 * Resolves `{ ok, reason, raw, data, toolName, filePath, command, sessionId,
 * cwd, eventName, transcriptPath }`. On failure every field but `ok`, `reason`
 * and `raw` is empty, so a caller can report without further guards.
 */
function readHookInput(stream = process.stdin) {
  return new Promise((resolve) => {
    let raw = '';
    const fail = (reason) => resolve({ ...EMPTY_INPUT, ok: false, reason, raw });
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => { raw += chunk; });
    stream.on('error', () => fail('unreadable'));
    stream.on('end', () => {
      if (raw.trim() === '') return fail('empty');
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return fail('not-json');
      }
      // A JSON scalar or array carries no tool payload and cannot be read as one.
      if (data === null || typeof data !== 'object' || Array.isArray(data)) return fail('not-an-object');
      const toolInput = (data.tool_input && typeof data.tool_input === 'object') ? data.tool_input : {};
      return resolve({
        ok: true,
        reason: null,
        raw,
        data,
        toolName: str(data.tool_name),
        filePath: str(toolInput.file_path),
        command: str(toolInput.command),
        sessionId: str(data.session_id),
        cwd: str(data.cwd),
        eventName: str(data.hook_event_name),
        transcriptPath: str(data.transcript_path),
      });
    });
  });
}

const str = (v) => (v === null || v === undefined ? '' : String(v));

const EMPTY_INPUT = {
  ok: true,
  reason: null,
  raw: '',
  data: {},
  toolName: '',
  filePath: '',
  command: '',
  sessionId: '',
  cwd: '',
  eventName: '',
  transcriptPath: '',
};

module.exports = { parseStdin, normalizeFilePath, readHookInput };
