// build-verify.cjs — PostToolUse handler: auto-run compile/lint after Edit/Write.
// Ported from post-write-build-verify.sh. Same logic:
//   classify file by extension → check cache → run compile/lint → emit errors.
//
// Env vars:
//   MEOWKIT_BUILD_VERIFY=off       — skip entirely
//   MEOWKIT_BUILD_VERIFY_TIMEOUT=N — override timeout (seconds)

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// File extension → compile/lint commands (run sequentially, short-circuit on failure)
const COMMANDS_BY_EXT = {
  ts: ['npx tsc --noEmit', 'npx eslint'],
  tsx: ['npx tsc --noEmit', 'npx eslint'],
  js: ['npx eslint'],
  jsx: ['npx eslint'],
  mjs: ['npx eslint'],
  cjs: ['npx eslint'],
  py: ['ruff check', 'mypy'],
  go: ['go build ./...'],
  rs: ['cargo check'],
  rb: ['ruby -c', 'rubocop'],
};

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
  // Bypass checks
  if (process.env.MEOWKIT_BUILD_VERIFY === 'off') return '';
  if (process.env.MEOWKIT_HARNESS_MODE === 'MINIMAL') return '';

  const filePath = ctx.tool_input?.file_path;
  if (!filePath || !fs.existsSync(filePath)) return '';

  // Skip non-source paths
  if (SKIP_PATTERNS.some((p) => p.test(filePath))) return '';

  // Get extension and commands
  const ext = path.extname(filePath).slice(1);
  const commands = COMMANDS_BY_EXT[ext];
  if (!commands) return '';

  const envTimeout = Number(process.env.MEOWKIT_BUILD_VERIFY_TIMEOUT);
  const timeoutMs = (Number.isFinite(envTimeout) && envTimeout > 0)
    ? envTimeout * 1000
    : (TIMEOUT_BY_EXT[ext] || DEFAULT_TIMEOUT);

  // Cache check
  const cache = state.load('build-verify-cache') || {};
  const hash = fileHash(filePath);
  if (hash && cache[filePath] === hash) return '';

  // Run commands sequentially
  let output = '';
  let failed = false;
  for (const cmd of commands) {
    const tool = cmd.split(/\s+/)[0];
    // Check if tool exists (skip npx — it's always available if node is)
    if (tool !== 'npx' && !whichSync(tool)) continue;

    try {
      const parts = cmd.split(/\s+/);
      execFileSync(parts[0], [...parts.slice(1), filePath], {
        cwd: ROOT,
        timeout: timeoutMs,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
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
    return `@@BUILD_VERIFY_ERROR@@\nfile: ${filePath}\n\n${lines}\n@@END_BUILD_VERIFY@@\n`;
  }

  // Cache the clean hash
  if (hash) {
    cache[filePath] = hash;
    state.save('build-verify-cache', cache);
  }

  return '';
};
