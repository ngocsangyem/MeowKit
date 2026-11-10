'use strict';
// hook-corpus-env.cjs — deterministic execution environment for the BASE hook
// golden-corpus recorder (scripts/record-hook-golden-corpus.cjs).
//
// Two jobs:
//   1. Extract the BASE hook tree out of git into a throwaway directory, so the
//      recorder never reads the working tree and the corpus can be re-recorded
//      from the pinned commit at any time.
//   2. Run one case under a PINNED environment and normalize the captured
//      streams, so two runs of the recorder produce byte-identical fixtures.
//
// Everything that varies run to run is pinned here: the locale, the timezone,
// the HOME directory, git identity and git dates (so commit SHAs are stable),
// and the inherited MEOWKIT_*/CLAUDE_*/HOOK_* variables, which are stripped so
// the recording host's own session can never leak into a fixture.

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/** Paths the recorder needs out of BASE: the hook tree plus every skill script a hook calls. */
const BASE_PATHSPECS = [
  '.claude/hooks',
  '.claude/skills/careful',
  '.claude/skills/freeze',
  '.claude/skills/investigate',
  '.claude/skills/sprint-contract',
  '.claude/skills/cook/scripts',
];

/**
 * PATH is pinned so `command -v` probes inside the BASE scripts resolve identically.
 * The running node's own directory is added because a CI runner installs node
 * outside every pinned directory, and a `#!/usr/bin/env node` stub then cannot
 * start. None of the POSIX directories exist on Windows, so there the inherited
 * PATH is kept as well, or `git` itself is unreachable.
 */
const PINNED_PATH = [
  '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/opt/homebrew/bin',
  path.dirname(process.execPath),
  ...(process.platform === 'win32' ? [process.env.PATH || ''] : []),
].join(path.delimiter);

/** Windows programs, git among them, need these to start at all. */
const WINDOWS_BASE_ENV = process.platform === 'win32'
  ? Object.fromEntries(['SystemRoot', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP']
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]))
  : {};

const FIXED_GIT_DATE = '2026-01-01T00:00:00+0000';

/**
 * Extract the BASE hook tree into `destDir` via `git archive`, so the recorder
 * reads the pinned commit rather than the working tree.
 */
function extractBase(repoRoot, baseSha, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const archive = execFileSync('git', ['archive', baseSha, '--', ...BASE_PATHSPECS], {
    cwd: repoRoot,
    maxBuffer: 256 * 1024 * 1024,
  });
  const tar = spawnSync('tar', ['-x', '-C', destDir], { input: archive });
  if (tar.status !== 0) {
    throw new Error(`tar -x failed: ${tar.stderr && tar.stderr.toString()}`);
  }
  return destDir;
}

/**
 * The pinned base environment. `home` is a per-case directory so nothing a hook
 * writes under $HOME can carry between cases.
 */
function pinnedEnv(home) {
  return {
    ...WINDOWS_BASE_ENV,
    PATH: PINNED_PATH,
    HOME: home,
    SHELL: '/bin/sh',
    TZ: 'UTC',
    LC_ALL: 'C',
    LANG: 'C',
    // No user/system gitconfig: identity, default branch and hooks all come from here.
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_AUTHOR_NAME: 'Corpus Recorder',
    GIT_AUTHOR_EMAIL: 'corpus@example.invalid',
    GIT_COMMITTER_NAME: 'Corpus Recorder',
    GIT_COMMITTER_EMAIL: 'corpus@example.invalid',
    GIT_AUTHOR_DATE: FIXED_GIT_DATE,
    GIT_COMMITTER_DATE: FIXED_GIT_DATE,
    // Keep npm/node quiet and reproducible for the pre-ship build/lint/test block.
    npm_config_update_notifier: 'false',
    npm_config_fund: 'false',
    npm_config_audit: 'false',
    NO_COLOR: '1',
    TERM: 'dumb',
  };
}

/**
 * Named normalizers. the contract allows exactly one substitution for the safety
 * corpus — `tmpdir` — so every other normalizer is opt-in per case and is
 * recorded in the fixture's `normalizers` field.
 */
const NORMALIZERS = {
  // The absolute path of the throwaway project. Varies per run by construction.
  tmpdir: (text, ctx) => text.split(ctx.projectDir).join('{{TMP}}'),
  // $HOME, for hooks that resolve state under it.
  homedir: (text, ctx) => text.split(ctx.home).join('{{HOME}}'),
  // `date -u +%Y-%m-%dT%H:%M:%SZ` — wall clock.
  isoTimestamp: (text) => text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, '{{TS}}'),
  // `date -u +%Y-%m-%d` — the approval receipt's stamp date.
  isoDate: (text) => text.replace(/\d{4}-\d{2}-\d{2}/g, '{{DATE}}'),
  // Process id, used in temp file names by approval-receipt.cjs.
  pid: (text) => text.replace(/\.approval\.\d+/g, '.approval.{{PID}}'),
};

function applyNormalizers(text, names, ctx) {
  let out = text;
  for (const name of names) {
    const fn = NORMALIZERS[name];
    if (!fn) throw new Error(`unknown normalizer: ${name}`);
    out = fn(out, ctx);
  }
  return out;
}

/**
 * Run one executable with pinned env, fixed cwd and the case's stdin/argv.
 * Returns raw (un-normalized) streams and the exit status.
 */
function runScript({ script, args = [], cwd, stdin, env, home }) {
  const result = spawnSync(script, args, {
    cwd,
    input: stdin === null || stdin === undefined ? '' : stdin,
    env: { ...pinnedEnv(home), ...env },
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  // spawnSync hands back a Buffer rather than a string when the child writes
  // bytes that are not valid in the requested encoding, so coerce explicitly.
  const toText = (v) => (v === null || v === undefined ? '' : Buffer.isBuffer(v) ? v.toString('utf8') : String(v));
  return {
    stdout: toText(result.stdout),
    stderr: toText(result.stderr),
    exit: result.status === null ? -1 : result.status,
    signal: result.signal || null,
  };
}

module.exports = {
  BASE_PATHSPECS,
  FIXED_GIT_DATE,
  NORMALIZERS,
  PINNED_PATH,
  applyNormalizers,
  extractBase,
  pinnedEnv,
  runScript,
};
