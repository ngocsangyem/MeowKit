// build-verify.cjs — PostToolUse handler: auto-run compile/lint after Edit/Write.
// Ported from post-write-build-verify.sh. Same logic:
//   classify file by extension → check cache → run compile/lint → report errors to the model.
//
// Settings, from the project config and nowhere else:
//   hooks.build-verify: false  — switch the observer off. The dispatcher drops
//                                the registration, so this file is never loaded.
//   buildVerify.timeoutMs      — override the per-command timeout.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { configValue } = require('../lib/read-config.cjs');
const { localBin, spawnPlan } = require('../lib/preship-checks.cjs');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// File extension → compile/lint commands (run sequentially, short-circuit on failure)
const COMMANDS_BY_EXT = {
  ts: ['tsc --noEmit', 'eslint'],
  tsx: ['tsc --noEmit', 'eslint'],
  js: ['eslint'],
  jsx: ['eslint'],
  mjs: ['eslint'],
  cjs: ['eslint'],
  py: ['ruff check', 'mypy'],
  go: ['go build ./...'],
  rs: ['cargo check'],
  rb: ['ruby -c', 'rubocop'],
};

// Commands that check the whole project and take no file argument: `cargo check <path>` and
// `go build ./... <path>` are usage errors that would reach the model as a build failure.
const WHOLE_PROJECT = new Set(['go build ./...', 'cargo check']);

// Node tools run from the project's own node_modules/.bin and nowhere else. `npx` with no
// terminal installs a missing package without asking — and the registry package named `tsc`
// is not TypeScript — so a project without the tool skips the check, as a missing ruff does.
const PROJECT_LOCAL = new Set(['tsc', 'eslint']);

const TIMEOUT_BY_EXT = {
  rs: 60000,
  js: 15000, jsx: 15000, mjs: 15000, cjs: 15000,
  rb: 20000,
};
const DEFAULT_TIMEOUT = 30000;

// Skip patterns — same as shell version
const SKIP_PATTERNS = [
  /\/node_modules\//, /\/.venv\//, /\/venv\//, /\/vendor\//,
  /\/target\//, /\/dist\//, /\/build\//, /\/.next\//, /\/out\//,
  /\/tasks\//, /\/docs\//, /\/.claude\//, /\/plans\//,
  /\.test\./, /\.spec\./, /\/__tests__\//, /\/tests\//,
  /\.min\.js$/, /\.map$/, /\.lock$/,
];

function fileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch {
    return null;
  }
}

function whichSync(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'pipe', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

module.exports = function buildVerify(ctx, state) {
  // Switching this observer off is the dispatcher's job: `hooks.build-verify:
  // false` removes the registration, so there is nothing to check here.
  if (configValue('autobuild.mode', '', { root: ctx.root }).value === 'MINIMAL') return '';

  const filePath = ctx.tool_input?.file_path;
  if (!filePath || !fs.existsSync(filePath)) return '';

  // Skip non-source paths
  if (SKIP_PATTERNS.some((p) => p.test(filePath))) return '';

  // Get extension and commands
  const ext = path.extname(filePath).slice(1);
  const commands = COMMANDS_BY_EXT[ext];
  if (!commands) return '';

  const configured = Number(configValue('buildVerify.timeoutMs', 0, { root: ctx.root }).value);
  const timeoutMs = (Number.isFinite(configured) && configured > 0)
    ? configured
    : (TIMEOUT_BY_EXT[ext] || DEFAULT_TIMEOUT);

  // Cache check
  const cache = state.load('build-verify-cache') || {};
  const hash = fileHash(filePath);
  if (hash && cache[filePath] === hash) return '';

  // Run commands sequentially
  let output = '';
  let failed = false;
  for (const cmd of commands) {
    const parts = cmd.split(/\s+/);
    const tool = parts[0];
    const executable = PROJECT_LOCAL.has(tool) ? localBin(ROOT, tool) : tool;
    // An absent tool is no verdict, so the check is skipped rather than failed.
    if (PROJECT_LOCAL.has(tool) ? !fs.existsSync(executable) : !whichSync(tool)) continue;
    const args = WHOLE_PROJECT.has(cmd) ? parts.slice(1) : [...parts.slice(1), filePath];
    // Windows cannot start a node_modules/.bin shim directly; the plan runs its script with node.
    const plan = spawnPlan(executable, args);
    if (!plan) continue;

    try {
      execFileSync(plan.command, plan.args, {
        cwd: ROOT,
        timeout: timeoutMs,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
        ...plan.options,
      });
    } catch (err) {
      output = (err.stdout?.toString() || '') + (err.stderr?.toString() || '');
      failed = true;
      break;
    }
  }

  if (failed) {
    // Truncate output to first 50 lines
    const lines = output.split('\n').slice(0, 50).join('\n');
    // Exit 2 with stderr is the PostToolUse form Claude Code shows to the model; plain
    // stdout reaches only the transcript. The edit has already happened either way.
    const advice = 'The edit was saved, but the build check now fails on this file. Fix these errors '
      + 'before further edits, since later changes stack on a broken build.';
    return { stderr: `@@BUILD_VERIFY_ERROR@@\nfile: ${filePath}\n${advice}\n\n${lines}\n@@END_BUILD_VERIFY@@\n`, exitCode: 2, feedback: true };
  }

  // Cache the clean hash
  if (hash) {
    cache[filePath] = hash;
    state.save('build-verify-cache', cache);
  }

  return '';
};
