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
// Two observers are an exception to "output is advisory", and both have their
// output passed through rather than swallowed: the write scanner reports a
// finding and fails the tool result, and the completion check answers with a
// block decision. Both are emitted only AFTER every other observer has run, so
// a block never costs the rest of the chain its turn.
//
// Each handler is required lazily inside the try block. Loading them up front
// would let one unparseable file take down the whole event.

const path = require('node:path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const HOOKS_DIR = path.join(ROOT, '.claude', 'hooks');

const report = (message) => process.stderr.write(`dispatch: ${message}\n`);

/**
 * Normalise what a handler returned. A plain string is stdout; an object may
 * also carry stderr and an exit code. Anything else is treated as "nothing to
 * say", so a handler that returns undefined is normal rather than an error.
 */
function normalizeResult(value) {
  if (!value) return null;
  if (typeof value === 'string') return { stdout: value, stderr: '', exitCode: 0, feedback: false };
  if (typeof value !== 'object') return null;
  return {
    stdout: typeof value.stdout === 'string' ? value.stdout : '',
    stderr: typeof value.stderr === 'string' ? value.stderr : '',
    exitCode: Number.isInteger(value.exitCode) ? value.exitCode : 0,
    feedback: value.feedback === true,
  };
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
    selected = selectHandlers(loadRegistry(ROOT), event, matcher);
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

  let exitCode = 0;
  for (const result of [...advisory, ...feedback]) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.exitCode > exitCode) exitCode = result.exitCode;
  }
  process.exit(exitCode);
}

main().catch((err) => {
  // A dispatcher fault is still fail-open: the event is lost, the work is not.
  report(`fatal: ${err.message}`);
  process.exit(0);
});
