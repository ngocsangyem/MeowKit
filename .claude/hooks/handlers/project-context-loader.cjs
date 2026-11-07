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
function contextBlock(root, env) {
  const raw = env.MEOWKIT_MAX_PROJECT_CONTEXT_BYTES;
  // Anything non-numeric falls back to the default rather than being used in
  // arithmetic, so a malformed value cannot turn the cap into nonsense.
  const cap = /^[0-9]+$/.test(String(raw || '')) ? Number(raw) : DEFAULT_MAX_BYTES;

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

/**
 * Control variables the agent cannot read for itself. Emitted only on a new
 * session, so a resume or a compaction does not repeat the block.
 */
function configBlock(env) {
  return [
    '',
    '## the toolkit Config',
    env.MEOWKIT_TDD === '1' ? '- TDD: **enabled** (strict red-green-refactor)' : '- TDD: off (default)',
    env.MEOWKIT_BUILD_VERIFY === 'off' ? '- Build verify: **disabled**' : '- Build verify: on (default)',
    env.MEOWKIT_LOOP_DETECT === 'off' ? '- Loop detection: **disabled**' : '- Loop detection: on (default)',
    env.MEOWKIT_AUTOBUILD_MODE ? `- Harness density: **${env.MEOWKIT_AUTOBUILD_MODE}** (overridden)` : '- Harness density: auto-detect',
    '',
    '_Config sources: settings.json `env` (defaults) → .meowkit/.env (overrides) → shell export (highest). Agent sees this block at session start only._',
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

  if (!fs.existsSync(path.join(root, '.claude/skills/.venv/bin/python3'))) {
    out.push(
      '## WARNING: Python venv not found',
      '',
      "the toolkit's scripts require `.claude/skills/.venv/bin/python3` but it doesn't exist.",
      'Run `npx mewkit setup` to create the venv and install dependencies.',
      'Until then, python-based skills (validate, security-scan, multimodal, llms) will fail.',
      '',
    );
  }

  out.push(...contextBlock(root, env));

  const sessionId = ctx.session_id || '';
  const previous = resetSessionState(root, sessionId);
  if (sessionId && sessionId !== previous) out.push(...configBlock(env));

  out.push('', ...R.directoryBlock(root), '', ...R.toolBlock(), '', ...R.scriptBlock(root));
  for (const block of [R.preferencesBlock(root), R.readinessBlock(root), R.memoryBlock(root)]) {
    if (block.length) out.push('', ...block);
  }
  return `${out.join('\n')}\n`;
};
