#!/usr/bin/env node
'use strict';
// dispatch.cjs — run the observers registered for one event.
//
//   node dispatch.cjs <EventName> [Matcher]
//
// Observers are fail-OPEN by contract. One that throws, fails to load, or has a
// syntax error is reported on stderr and the rest still run, because an
// observer's job is to watch: a broken watcher must not stop the work it was
// watching. That is exactly why the write guards are NOT routed through here —
// they need the opposite behavior and are registered on their own.
//
// Three observers are an exception to "output is advisory", and their output is
// passed through rather than swallowed: the write scanner and the build check
// report a failure the model sees (exit 2, stderr), and the opt-in completion
// check answers with a JSON block decision. These are emitted only AFTER every
// other observer has run, so a block never costs the rest of the chain its turn.
//
// A handler that has something the model should act on returns it as `context`.
// Claude Code reads plain stdout on PreToolUse/PostToolUse as transcript only, so
// there that text goes out as `hookSpecificOutput.additionalContext`, the
// documented model-visible field. On UserPromptSubmit and SessionStart plain
// stdout already reaches the model, so context is written as stdout unless a
// JSON document is being sent. When an observer exits non-zero the host ignores
// stdout JSON (exit 2 shows stderr), so the context joins stderr instead. Events
// with no model-visible field for it drop the context and say so on stderr.
//
// stdout is either plain text or one JSON document, never both, because the host
// parses it as JSON only when JSON is all there is. When a document goes out,
// leftover plain stdout rides in it: as more `additionalContext` on events whose
// stdout the model reads, as `systemMessage` (shown to the user) elsewhere.
//
// Each handler is required lazily inside the try block. Loading them up front
// would let one unparseable file take down the whole event.

const path = require('node:path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const HOOKS_DIR = path.join(ROOT, '.claude', 'hooks');

const report = (message) => process.stderr.write(`dispatch: ${message}\n`);

/** Events whose plain stdout the host shows to the model. */
const MODEL_STDOUT_EVENTS = new Set(['UserPromptSubmit', 'SessionStart']);

/** Events that accept `hookSpecificOutput.additionalContext`. */
const CONTEXT_EVENTS = new Set(['PreToolUse', 'PostToolUse', 'PostToolUseFailure', ...MODEL_STDOUT_EVENTS]);

/** The host caps one hook's model-visible text at 10,000 characters. */
const CONTEXT_LIMIT = 10000;

/**
 * Normalise what a handler returned. A plain string is stdout; an object may
 * also carry stderr and an exit code. Anything else is treated as "nothing to
 * say", so a handler that returns undefined is normal rather than an error.
 */
function normalizeResult(value) {
  if (!value) return null;
  if (typeof value === 'string') return { stdout: value, stderr: '', context: '', exitCode: 0, feedback: false };
  if (typeof value !== 'object') return null;
  return {
    stdout: typeof value.stdout === 'string' ? value.stdout : '',
    stderr: typeof value.stderr === 'string' ? value.stderr : '',
    context: typeof value.context === 'string' ? value.context.trim() : '',
    exitCode: Number.isInteger(value.exitCode) ? value.exitCode : 0,
    feedback: value.feedback === true,
  };
}

/** The object a stdout string holds when it is exactly one JSON object, else null. */
function parseObject(text) {
  if (typeof text !== 'string' || !text.trim().startsWith('{')) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

async function callHandler(entry, ctx, state) {
  const absPath = path.resolve(HOOKS_DIR, entry.handler);
  const handler = require(absPath);
  const run = typeof handler === 'function' ? handler : handler.run;
  if (typeof run !== 'function') throw new Error('exports no callable handler');
  return normalizeResult(await run(ctx, state));
}

async function main() {
  const event = process.argv[2] || '';
  const matcher = process.argv[3] || '';

  const { loadRegistry, selectHandlers } = require(path.join(HOOKS_DIR, 'lib', 'handler-registry.cjs'));

  let selected;
  try {
    selected = selectHandlers(loadRegistry(ROOT), event, matcher, { root: ROOT });
  } catch (err) {
    // No registry means no observers to run. Report it and stand aside: the
    // guards are registered independently and are unaffected.
    report(err.message);
    process.exit(0);
  }
  if (selected.length === 0) process.exit(0);

  const { readHookInput, normalizeFilePath } = require(path.join(HOOKS_DIR, 'lib', 'parse-stdin.cjs'));
  const input = await readHookInput();
  const state = require(path.join(HOOKS_DIR, 'lib', 'shared-state.cjs'));

  // Handlers receive the parsed payload plus the resolved root, so none of them
  // has to re-derive either. Unreadable input is passed through as an empty
  // payload: an observer with nothing to look at simply has nothing to do.
  //
  // Two spellings of the target path are exposed because handlers need
  // different ones. `tool_input.file_path` is resolved against the session cwd,
  // which is what the state-keeping handlers key on. `hookInput.filePath` is the
  // path exactly as the payload spelled it, which the handlers that print it or
  // match it against repo-relative rules must use — resolving it there would
  // change both the message and the rule outcome.
  const ctx = { ...input.data, root: ROOT, hookInput: input, event, matcher };
  if (ctx.tool_input && typeof ctx.tool_input === 'object') {
    ctx.tool_input = { ...ctx.tool_input, file_path: normalizeFilePath(ctx.tool_input.file_path, input.cwd) };
  }

  const advisory = [];
  const feedback = [];

  for (const entry of selected) {
    try {
      const result = await callHandler(entry, ctx, state);
      if (result) (result.feedback ? feedback : advisory).push(result);
    } catch (err) {
      report(`handler ${entry.handler} error: ${err.message}`);
    }
  }

  const results = [...advisory, ...feedback];
  const exitCode = results.reduce((max, r) => Math.max(max, r.exitCode), 0);
  for (const r of results) if (r.stderr) process.stderr.write(r.stderr);

  // A feedback result may answer in the host's JSON form (a Stop block decision).
  const isHostJson = (r) => r.feedback && parseObject(r.stdout) !== null;
  const hostJson = results.filter(isHostJson).map((r) => parseObject(r.stdout));
  const plain = results.filter((r) => r.stdout && !isHostJson(r)).map((r) => r.stdout).join('');
  let context = results.map((r) => r.context).filter(Boolean).join('\n\n');

  if (exitCode !== 0) {
    process.stdout.write(plain);
    if (context) process.stderr.write(`${context}\n`);
    process.exit(exitCode);
  }
  if (context && !CONTEXT_EVENTS.has(event)) {
    report(`${event} has no model-visible field for observer context; dropped: ${context.slice(0, 200)}`);
    context = '';
  }

  const modelReadsStdout = MODEL_STDOUT_EVENTS.has(event);
  if (hostJson.length === 0 && (!context || modelReadsStdout)) {
    process.stdout.write(plain + (context ? `${context}\n` : ''));
    process.exit(0);
  }

  const doc = Object.assign({}, ...hostJson);
  // Two handlers may each have a line for the user (a completion notice, a plan-state line);
  // a plain merge would keep only the last one.
  const notices = hostJson.map((d) => d.systemMessage).filter((m) => typeof m === 'string' && m);
  if (notices.length > 1) doc.systemMessage = notices.join('\n');
  let forModel = [modelReadsStdout ? plain.trim() : '', context].filter(Boolean).join('\n\n');
  if (forModel.length > CONTEXT_LIMIT) forModel = `${forModel.slice(0, CONTEXT_LIMIT - 20)}\n[truncated]`;
  if (forModel) doc.hookSpecificOutput = { ...doc.hookSpecificOutput, hookEventName: event, additionalContext: forModel };
  if (!modelReadsStdout && plain.trim()) doc.systemMessage = [doc.systemMessage, plain.trim()].filter(Boolean).join('\n');
  process.stdout.write(`${JSON.stringify(doc)}\n`);
  process.exit(exitCode);
}

main().catch((err) => {
  // A dispatcher fault is still fail-open: the event is lost, the work is not.
  report(`fatal: ${err.message}`);
  process.exit(0);
});
