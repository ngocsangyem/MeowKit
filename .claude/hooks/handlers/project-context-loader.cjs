'use strict';
// project-context-loader.cjs — inject the project's own context at session start,
// and reset the per-session counters a new session should not inherit.
//
// Two jobs, both of which have to happen before the first turn:
//
//   1. Put the project's conventions, shape and tooling into context. An agent
//      cannot read a directory listing or a process environment, so anything it
//      should know has to arrive as text.
//   2. Clear state that belongs to the previous session. Leaving it in place is
//      how a stale edit count or a stale test-first sentinel silently changes
//      how the next session behaves.
//
// What is NOT cleared matters as much: the active-plan pointer is cross-session
// coordination state that later steps read, and the completion-attempt counter
// owns its own lifecycle, because the host assigns a new session id for every
// blocked stop and resetting it here would uncap the loop it exists to bound.

const fs = require('node:fs');
const path = require('node:path');

const R = require('../lib/session-context-report.cjs');
const { configValue } = require('../lib/read-config.cjs');
const { isTddEnabled } = require('../lib/tdd-detect.cjs');

const CONTEXT_FILE = 'docs/project-context.md';
const DEFAULT_MAX_BYTES = 12288;

const readText = (file) => {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
};

/**
 * Size is gated BEFORE injection, not warned about after: an oversized context
 * file that is already in the window has already cost what it was going to cost.
 * A cap of zero disables the gate entirely.
 */
function contextBlock(root) {
  const raw = configValue('projectContext.maxBytes', DEFAULT_MAX_BYTES, { root }).value;
  // Anything non-numeric falls back to the default rather than being used in
  // arithmetic, so a malformed value cannot turn the cap into nonsense.
  const cap = /^[0-9]+$/.test(String(raw)) ? Number(raw) : DEFAULT_MAX_BYTES;

  const file = path.join(root, CONTEXT_FILE);
  const content = readText(file);
  if (content === null) {
    return [
      '## Project Context',
      '',
      'No project-context.md found. Run `mk:project-context generate` to create one.',
      "This file helps all agents understand your project's tech stack, conventions, and anti-patterns.",
    ];
  }

  const head = ['## Project Context (auto-loaded)', ''];
  if (cap === 0) return [...head, content.replace(/\n$/, '')];

  const bytes = Buffer.byteLength(content, 'utf8');
  const truncated = () => Buffer.from(content, 'utf8').subarray(0, cap).toString('utf8');
  if (bytes > cap * 2) {
    return [...head, `## ⚠⚠ project-context.md is ${bytes}B (>${cap * 2}B). Truncating to ${cap}B.`, '', truncated(), ''];
  }
  if (bytes > cap) {
    return [...head, `## ⚠ project-context.md is ${bytes}B (>${cap}B). Consider trimming.`, '', truncated(), ''];
  }
  return [...head, content.replace(/\n$/, '')];
}

/** State a new session must not inherit. */
function resetSessionState(root, sessionId) {
  const dir = path.join(root, 'session-state');
  const lastFile = path.join(dir, 'last-session-id');
  try { fs.mkdirSync(dir, { recursive: true }); } catch { return null; }

  if (!sessionId) return null;
  const previous = readText(lastFile);
  if (previous !== null && previous === sessionId) return previous;

  const write = (rel, content) => {
    try { fs.writeFileSync(path.join(dir, rel), content); } catch { /* best effort */ }
  };
  write('edit-counts.json', '{}');
  write('build-verify-cache.json', '{}');
  // Keyed by session id, so a recycled id could otherwise match a stale entry.
  write('session-sentinels.jsonl', '');
  for (const rel of ['.claude/session-state/tdd-mode', '.claude/session-state/tdd-deprecation-warned']) {
    try { fs.rmSync(path.join(root, rel), { force: true }); } catch { /* best effort */ }
  }
  try { fs.writeFileSync(lastFile, sessionId); } catch { /* best effort */ }
  return previous;
}

/** Where an answer came from, in the words a reader can act on. */
const SOURCE_LABEL = {
  env: 'environment override',
  flag: 'session flag',
  sentinel: 'session flag',
  project: '.meowkit/config.yaml',
  user: '~/.meowkit/config.yaml',
  default: 'default',
};

/**
 * Settings the agent cannot read for itself. Emitted only on a new session, so a
 * resume or a compaction does not repeat the block.
 *
 * Every row is the EFFECTIVE value, resolved by the same reader the handlers
 * resolve from, and carries the level that answered. Reporting the environment
 * instead was how a project that had switched a setting on was told at session
 * start that it was off: the settings these name live in the config file now,
 * and an agent acting on the inverse of its own project's state has no way to
 * find out it was misinformed.
 */
function configBlock(env, root) {
  // The gate warns about an unrecognised override where that warning is
  // load-bearing; repeating it in a session banner would be noise.
  const tdd = isTddEnabled({ root, env, warn: () => {} });
  const at = (level) => ` (${SOURCE_LABEL[level] || level})`;
  const row = (label, text, level) => `- ${label}: ${text}${at(level)}`;

  const verify = configValue('hooks.build-verify', true, { root });
  const loop = configValue('hooks.loop-detection', true, { root });
  const density = configValue('autobuild.mode', '', { root });
  const cap = configValue('budget.cap', 0, { root });
  const capUsd = /^[0-9]+$/.test(String(cap.value)) ? Number(cap.value) : 0;

  return [
    '',
    '## the toolkit Config',
    row('TDD', tdd.enabled ? '**enabled** (strict red-green-refactor)' : 'off', tdd.source),
    row('Build verify', verify.value === false ? '**disabled**' : 'on', verify.level),
    row('Loop detection', loop.value === false ? '**disabled**' : 'on', loop.level),
    row('Harness density', density.value === '' ? 'auto-detect' : `**${density.value}**`, density.level),
    row('Budget cap', capUsd > 0 ? `**$${capUsd}** per run` : 'none', cap.level),
    '',
    '_Resolved per setting, highest level first: a supported environment override → `.meowkit/config.yaml` → `~/.meowkit/config.yaml` → the built-in default. Agent sees this block at session start only._',
  ];
}

module.exports = function projectContextLoader(ctx, _state, env = process.env) {
  const root = ctx.root;
  const out = [];

  // The dispatcher's own presence is the marker for "this is a managed root".
  // Without it the control variables below were never loaded and saying so is
  // more useful than emitting a block that describes defaults.
  if (!fs.existsSync(path.join(root, '.claude/hooks/dispatch.cjs'))) {
    out.push("## NOTE: the toolkit's hooks not detected at project root", 'MEOWKIT_* config may not be loaded. Run from project root where .claude/ lives.', '');
  }

  // No interpreter check here. Session start is the wrong place to ask: nothing
  // in the core workflow needs an interpreter, so a warning at every session
  // start would be noise for most sessions and would train the reader to skip
  // the block. A skill that does need one reports it at the moment it is
  // invoked, naming itself and the command that provisions it.

  out.push(...contextBlock(root));

  const sessionId = ctx.session_id || '';
  const previous = resetSessionState(root, sessionId);
  const newSession = Boolean(sessionId) && sessionId !== previous;
  if (newSession) out.push(...configBlock(env, root));
  // Once per session, not once per event: a resume or a compaction re-runs this
  // handler, and a hint repeated every time is one a reader learns to skip.
  if (newSession) {
    const install = R.installBlock(root, env);
    if (install.length) out.push('', ...install);
  }

  out.push('', ...R.directoryBlock(root), '', ...R.toolBlock(), '', ...R.scriptBlock(root));
  for (const block of [R.preferencesBlock(root), R.readinessBlock(root), R.memoryBlock(root)]) {
    if (block.length) out.push('', ...block);
  }
  return `${out.join('\n')}\n`;
};
