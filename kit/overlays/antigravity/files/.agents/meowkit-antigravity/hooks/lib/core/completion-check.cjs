'use strict';
// completion-check.cjs — the opt-in end-of-turn check for edits left unverified.
//
// Shared by the Claude Code observer and Stop handler and by the Codex and Cursor stop hooks
// (copied byte for byte by the kit's sync script), so the rule is the same everywhere:
//
//   1. After a shell command that names a test, build, lint or type-check runner passes, the
//      observer stores a digest of the working tree.
//   2. At stop, when the tree no longer matches that digest, the check asks for one more
//      turn, at most CAP times per session, then lets the session end with a notice.
//
// Before any pass, the digest compared against is the session's baseline: the tree as it
// stood at session start (where the runtime has a start hook) or at the first stop. Changes
// that were already in the tree when the session began never arm the check.
//
// Edits are read from the working tree, not from an edit hook, so a file rewritten through
// the shell counts. Outside a git repository the check never arms.
//
// This is evidence of effort, not proof: a trivial passing command satisfies it, and the
// agent can write the state file. Only the command class, a timestamp and a digest are
// stored, never command output or arguments.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { runInner, finishedJob } = require('./host-evidence.cjs');

const CAP = 2;
const STATE_FILE = 'completion-evidence.json';

/** Kit state that changes on every hook run; it must not count as an edit. */
const IGNORED_PATHS = [
  '.meowkit/state', '.meowkit/telemetry', '.meowkit/cache',
  'session-state', '.claude/session-state', '.claude/logs', '.claude/cache',
];

// Runner patterns per class, matched against one `&&`-joined segment after env assignments
// and package-runner prefixes are stripped. Order matters: type-check before build, so
// `tsc --noEmit` is a type-check and a bare `tsc` is a build.
const CLASSES = [
  ['test', /^(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test\b|vitest\b|jest\b|mocha\b|ava\b|pytest\b|python3?\s+-m\s+(?:pytest|unittest)\b|cargo\s+(?:test|nextest)\b|go\s+test\b|node\s+--test\b|swift\s+test\b|playwright\s+test\b|rspec\b|phpunit\b|make\s+test\b|(?:ba)?sh\s+\S*test\S*\.sh\b)/],
  ['typecheck', /^(?:tsc\b.*--noEmit\b|vue-tsc\b|(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:typecheck|type-check|tsc)\b|mypy\b|pyright\b|cargo\s+check\b)/],
  ['lint', /^(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?lint\b|eslint\b|biome\s+(?:check|lint)\b|ruff\s+check\b|cargo\s+clippy\b|golangci-lint\b|rubocop\b|swiftlint\b)/],
  ['build', /^(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?build\b|tsc\b|cargo\s+build\b|go\s+build\b|swift\s+build\b|vite\s+build\b|next\s+build\b|make\b(?!\s+-n))/],
];

const PREFIX = /^(?:(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+|(?:npx|bunx|pnpm\s+exec|pnpm\s+dlx|yarn\s+dlx|uv\s+run|poetry\s+run)\s+)/;

/**
 * The verification class a command belongs to, or null. A command whose exit status could
 * come from something other than the runner (`;`, `||`, a pipe, backgrounding, a subshell) is
 * never classified: `npm test | tail` exits 0 when the tests fail.
 */
function classifyCommand(command) {
  if (typeof command !== 'string') return null;
  const text = command.trim();
  if (!text || /[;`]|\|\||(^|[^|])\|(?!\|)|(^|[^&])&(?!&)|\$\(/.test(text)) return null;
  for (let segment of text.split('&&')) {
    segment = segment.trim().replace(/^cd\s+\S+$/, '');
    if (!segment) continue;
    let prev;
    do { prev = segment; segment = segment.replace(PREFIX, ''); } while (segment !== prev);
    const inner = runInner(segment);
    if (inner !== null) return classifyCommand(inner);
    for (const [cls, re] of CLASSES) if (re.test(segment)) return cls;
  }
  return null;
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000, maxBuffer: 256 * 1024 * 1024 });
}

/**
 * A digest of the working tree: HEAD, every tracked change (staged or not) and the untracked
 * files by size and mtime. Null outside a git repository or when git fails.
 */
function treeDigest(root) {
  try {
    if (git(root, ['rev-parse', '--is-inside-work-tree']).toString().trim() !== 'true') return null;
    const top = git(root, ['rev-parse', '--show-toplevel']).toString().trim();
    const excludes = IGNORED_PATHS.map((p) => `:(exclude)${p}`);
    const hash = crypto.createHash('sha256');
    let head = 'no-head';
    try { head = git(top, ['rev-parse', 'HEAD']).toString().trim(); } catch { /* unborn branch */ }
    hash.update(`head:${head}\n`);
    const base = head === 'no-head' ? [] : ['HEAD'];
    hash.update(git(top, ['diff', ...base, '--binary', '--no-ext-diff', '--no-color', '--', '.', ...excludes]));
    if (!base.length) hash.update(git(top, ['diff', '--cached', '--binary', '--no-ext-diff', '--no-color', '--', '.', ...excludes]));
    const untracked = git(top, ['ls-files', '--others', '--exclude-standard', '-z', '--', '.', ...excludes]).toString().split('\0').filter(Boolean).sort();
    for (const rel of untracked) {
      let stamp = 'gone';
      try { const s = fs.statSync(path.join(top, rel)); stamp = `${s.size}:${s.mtimeMs}`; } catch { /* removed meanwhile */ }
      hash.update(`untracked:${rel}:${stamp}\n`);
    }
    return hash.digest('hex');
  } catch {
    return null;
  }
}

/**
 * Whether the check is switched on in a config file's text: `hooks:` with
 * `pre-completion-check: true` under it, or the flat `hooks.pre-completion-check: true`.
 * For the runtimes that install without the Claude Code config reader; there the project
 * file wins over the user file, as it does in the reader.
 */
function enabledInConfigText(text) {
  if (typeof text !== 'string') return null;
  const flat = text.match(/^hooks\.pre-completion-check:\s*(true|false)\s*(?:#.*)?$/m);
  if (flat) return flat[1] === 'true';
  const block = text.match(/^hooks:[ \t]*\n((?:[ \t]+.*\n?|[ \t]*\n)*)/m);
  const nested = block && block[1].match(/^[ \t]+pre-completion-check:\s*(true|false)\s*(?:#.*)?$/m);
  return nested ? nested[1] === 'true' : null;
}

function enabledFor(root, home = require('node:os').homedir()) {
  for (const file of [path.join(root, '.meowkit', 'config.yaml'), path.join(home, '.meowkit', 'config.yaml')]) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const value = enabledInConfigText(text);
    if (value !== null) return value;
  }
  return false;
}

function readState(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function writeState(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

/** State for this session; another session's record is ignored, so a pass is never inherited. */
function sessionState(file, sessionId) {
  const state = readState(file);
  if (state && state.sessionId === (sessionId || '')) return state;
  return { sessionId: sessionId || '', blocks: 0 };
}

/**
 * Record a passing verification command. Returns the class recorded, or null. A
 * `mewkit host jobs wait` counts only for a done(0) job that ran on this very tree.
 */
function recordPass({ root, stateFile, sessionId, command, now = Date.now(), home }) {
  const job = finishedJob(command, home, root);
  const cls = job ? job.cls : classifyCommand(command);
  if (!cls) return null;
  const digest = treeDigest(root);
  if (!digest || (job && job.digest !== digest)) return null;
  const state = sessionState(stateFile, sessionId);
  writeState(stateFile, { ...state, lastPassAt: new Date(now).toISOString(), lastPassCommandClass: cls, treeDigestAtPass: digest });
  return cls;
}

/** Record the tree a session starts from, unless this session already has a record. */
function recordBaseline({ root, stateFile, sessionId }) {
  const state = sessionState(stateFile, sessionId);
  if (state.treeDigestAtPass) return false;
  const digest = treeDigest(root);
  if (!digest) return false;
  writeState(stateFile, { ...state, treeDigestAtPass: digest, lastPassCommandClass: 'baseline' });
  return true;
}

const BLOCK_REASON = 'Files changed since the last passing test, build, lint or type-check run in this session. Run the project\'s checks on the change, or say plainly that it is unverified, before ending the turn.';

/**
 * Decide a stop. `{ action: 'allow' }`, `{ action: 'block', reason }` or
 * `{ action: 'notice', message }` once the cap is spent.
 */
function decideStop({ root, stateFile, sessionId, stopHookActive = false, cap = CAP }) {
  const digest = treeDigest(root);
  if (!digest) return { action: 'allow' };
  const state = sessionState(stateFile, sessionId);
  if (!state.treeDigestAtPass) {
    writeState(stateFile, { ...state, treeDigestAtPass: digest, lastPassCommandClass: 'baseline' });
    return { action: 'allow' };
  }
  if (state.treeDigestAtPass === digest) return { action: 'allow' };
  if ((state.blocks || 0) >= cap) {
    if (state.noticed === digest) return { action: 'allow' };
    writeState(stateFile, { ...state, noticed: digest });
    return { action: 'notice', message: `Completion check: edits in this session are still unverified after ${cap} reminders. Ending the turn anyway.` };
  }
  // A continuation the host started because of an earlier block still counts against the cap.
  writeState(stateFile, { ...state, blocks: (state.blocks || 0) + 1, stopHookActive: Boolean(stopHookActive) });
  return { action: 'block', reason: BLOCK_REASON };
}

module.exports = { CAP, STATE_FILE, IGNORED_PATHS, classifyCommand, treeDigest, recordPass, recordBaseline, decideStop, sessionState, enabledInConfigText, enabledFor };
