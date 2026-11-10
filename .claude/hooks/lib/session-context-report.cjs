'use strict';
// session-context-report.cjs — the environment blocks injected at session start.
//
// The agent cannot inspect a directory listing or a process environment, so
// anything it should know about the workspace has to be written into context as
// text. Each block answers a question that otherwise becomes a wrong guess:
// what is here, what tooling exists, how to run things, and how ready the repo
// is for an agent to work in it.

const fs = require('node:fs');
const path = require('node:path');

const { memoryDir, stateDir } = require('./meowkit-paths.cjs');

/** Trees that say nothing about the project's own shape. */
const IGNORED_DIRS = ['node_modules', '.git', '.venv', 'target', 'dist', 'build', '.next'];
const MAX_DIRS = 30;
const DIRECTORY_DEPTH = 2;
const TOOLS = ['python3', 'node', 'pnpm', 'npm', 'yarn', 'bun', 'uv', 'cargo', 'go', 'rustc', 'tsc', 'eslint', 'ruff', 'mypy'];
const MAX_SCRIPTS = 10;
const MEMORY_LINE_CAP = 300;

const exists = (root, rel) => fs.existsSync(path.join(root, rel));

const readText = (file) => {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
};

/** Directories to the configured depth, depth-first with siblings sorted by name. */
function directoryBlock(root) {
  const out = ['.'];
  const walk = (rel, depth) => {
    if (depth > DIRECTORY_DEPTH) return;
    let entries;
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || IGNORED_DIRS.includes(entry.name)) continue;
      const child = rel === '.' ? `./${entry.name}` : `${rel}/${entry.name}`;
      out.push(child);
      walk(child, depth + 1);
    }
  };
  walk('.', 1);
  return ['## Directory (depth 2)', ...out.slice(0, MAX_DIRS)];
}

/**
 * Tool discovery by attempted launch rather than a path scan, so the answer is
 * "can this actually start" rather than "does a file with that name exist".
 */
function toolBlock() {
  const { spawnSync } = require('node:child_process');
  const found = TOOLS.filter((tool) => {
    const r = spawnSync(tool, ['--version'], { stdio: 'ignore' });
    return !(r.error && r.error.code === 'ENOENT');
  });
  return ['## Tools available', ...found.map((t) => `  - ${t}`)];
}

function scriptBlock(root) {
  const manifest = readText(path.join(root, 'package.json'));
  if (manifest !== null) {
    try {
      const scripts = JSON.parse(manifest).scripts || {};
      const names = Object.keys(scripts).sort();
      const shown = names.slice(0, MAX_SCRIPTS).map((k) => `  - ${k}`);
      if (names.length > MAX_SCRIPTS) shown.push(`  ... (${names.length - MAX_SCRIPTS} more)`);
      return ['## Package scripts', ...shown];
    } catch {
      // An unparseable manifest says nothing rather than something wrong.
      return ['## Package scripts'];
    }
  }
  if (exists(root, 'pyproject.toml')) return ['## Package scripts', '  (pyproject.toml detected — scripts in [project.scripts] or [tool.poetry.scripts])'];
  if (exists(root, 'Cargo.toml')) return ['## Package scripts', "  (Cargo.toml detected — run 'cargo build' / 'cargo test')"];
  return ['## Package scripts', '  (no recognized manifest)'];
}

function preferencesBlock(root) {
  const prefs = readText(path.join(stateDir('state', root), 'preferences.md'));
  if (prefs === null) return [];
  return ['## Personal Preferences', '<preferences-data>', prefs.replace(/\n$/, ''), '', '</preferences-data>', '', 'Note: Project rules in .claude/rules/ override personal preferences.'];
}

/** Which of the commands an agent needs to verify its own work exist. */
function detectCommands(root) {
  const read = (rel) => readText(path.join(root, rel));
  const pkg = read('package.json');
  if (pkg !== null) {
    return { test: pkg.includes('"test"'), lint: pkg.includes('"lint"'), typecheck: /"typecheck"|"tsc"/.test(pkg) };
  }
  const py = read('pyproject.toml');
  if (py !== null) {
    return { test: /pytest|unittest/.test(py), lint: /ruff|flake8|pylint/.test(py), typecheck: /mypy|pyright/.test(py) };
  }
  const make = read('Makefile');
  if (make !== null) return { test: /test:/.test(make), lint: /lint:/.test(make), typecheck: false };
  if (exists(root, 'Cargo.toml')) return { test: true, lint: false, typecheck: false };
  return { test: false, lint: false, typecheck: false };
}

/** An advisory score: what an agent would be missing before it starts work here. */
function readinessBlock(root) {
  const missing = [];
  let score = 0;
  // The kit ships no root instructions file, so the always-on core rule is the install marker.
  if (exists(root, '.claude/rules/meowkit-core.md')) score += 1; else missing.push('core-rules');
  if (exists(root, 'docs/project-context.md')) score += 1; else missing.push('project-context');

  const cmds = detectCommands(root);
  for (const [key, label] of [['test', 'test-cmd'], ['lint', 'lint-cmd'], ['typecheck', 'typecheck']]) {
    if (cmds[key]) score += 1; else missing.push(label);
  }

  const lines = [`## Agent Readiness: ${score}/5`];
  if (missing.length) lines.push(`Missing: ${missing.join(' ')}`);
  return lines;
}

/**
 * Where a `mewkit` the hooks could call would be found, or null.
 *
 * Named for what it returns, because a second resolver in this directory returns
 * a spawn target that is never null: swapping the two would make this one's
 * caller stop emitting the hint and the other's hand `null` to `spawnSync` on a
 * pre-ship path.
 *
 * Resolution only — nothing is spawned. A clone of a project whose `.claude/` is
 * committed has the whole kit and none of the CLI: no `node_modules`, no global
 * install, and no committed launcher. Checking the places it could be is cheap;
 * spawning a process at session start to find out is not. `MEOWKIT_CLI` is first
 * because the guard that honours it would run against a CLI this function had
 * already reported absent.
 */
function locateCliOnPath(root, env) {
  const candidates = [
    ...(env.MEOWKIT_CLI ? [env.MEOWKIT_CLI] : []),
    path.join(root, '.meowkit', 'bin', 'mewkit'),
    path.join(root, 'node_modules', '.bin', 'mewkit'),
    ...String(env.PATH || '').split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, 'mewkit')),
  ];
  for (const candidate of candidates) {
    try { if (fs.existsSync(candidate)) return candidate; } catch { /* unreadable PATH entry */ }
  }
  return null;
}

/**
 * Say it once when the CLI is absent, and name the command that explains why.
 *
 * Without it the degradation is silent in exactly the situation where it matters:
 * a fresh clone runs every gate and guard correctly — none of them needs the CLI
 * — while the checks that DO call it skip, and nothing on screen connects the
 * skipped line to the missing install. The hint is emitted from the session-start
 * block, so it appears once per session rather than once per event.
 */
function installBlock(root, env = process.env) {
  if (locateCliOnPath(root, env) !== null) return [];
  return [
    '## MeowKit CLI not available',
    'This project carries `.claude/` but no `mewkit` CLI (no committed launcher, no node_modules, nothing on PATH).',
    'Gates, guards and observers all still run — none of them needs it — but the checks that call it skip instead.',
    'Run `mewkit doctor` (via `npx`, since nothing is installed here) to see what this clone is missing.',
  ];
}

/** Warn when a memory file has outgrown the budget. Display only, never a mutation. */
function memoryBlock(root) {
  const dir = memoryDir(root);
  let entries;
  try { entries = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort(); } catch { return []; }
  const bloated = entries
    .map((f) => ({ f, lines: (readText(path.join(dir, f)) || '').split('\n').length - 1 }))
    .filter(({ lines }) => lines > MEMORY_LINE_CAP)
    .map(({ f, lines }) => `${f}:${lines}lines`);
  if (!bloated.length) return [];
  return ['## Memory files', `⚠ Memory files >300 lines: ${bloated.join(' ')}`, '  Run `/mk:memory --prune` to propose removals.'];
}

module.exports = { directoryBlock, installBlock, locateCliOnPath, memoryBlock, preferencesBlock, readinessBlock, scriptBlock, toolBlock, detectCommands };
