'use strict';
// preship-checks.cjs — the lint, test and type-check block the ship check runs.
//
// Scope is the files the ship action carries (lib/changed-files.cjs):
//   lint        the changed files, when a linter that takes file arguments is installed;
//               otherwise the project's own lint script, project-wide
//   tests       only those the runner can relate to the changed files (vitest `related`,
//               jest `--findRelatedTests`). A runner with no such mode runs no tests, and the
//               output says so — lint and type-check still run
//   type-check  project-wide, because a change can break a caller in a file it never touched
//
// Each check is detected before it runs, and an absent optional tool is a named SKIP rather than
// a silent pass or a false failure. Tool discovery attempts the spawn and reads "no such
// executable" instead of scanning the search path, so the probe and the launch cannot disagree.
//
// Two outcomes block, kept apart because they mean different things: `failed` is a check that
// ran and reported a problem; `could_not_run` is a check that gave no verdict — a required tool
// missing or failing to start, or a check stopped at the deadline. A failure anywhere wins over
// could-not-run, since a known problem leaves nothing for a human to judge.
//
// Every spawn shares one deadline shorter than the host's hook timeout: a host that kills a
// hook prints nothing, so a slow check is stopped here and reported as not finished.
//
// Child output is discarded on purpose: only the verdict is useful, and a runner's full output
// would bury the summary the model has to act on.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

/** Below the 300 s the registrations give the ship-check hook. */
const DEFAULT_DEADLINE_MS = 270_000;
const JS_FILE = /\.(?:[cm]?[jt]sx?|vue)$/;
const PY_FILE = /\.py$/;
const SWIFT_FILE = /\.swift$/;
const ESLINT_CONFIG = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts', '.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml'];
const NO_RELATED_TESTS = 'Tests did not run: the test runner cannot name the tests related to the changed files (lint and type-check only).';

function exists(root, rel) {
  try { return fs.statSync(path.join(root, rel)).isFile(); } catch { return false; }
}

function readPackage(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); } catch { return null; }
}

/** True when the failure was "this executable does not exist" rather than a check result. */
const isMissingExecutable = (result) => Boolean(result.error && result.error.code === 'ENOENT');

/** Collects output lines and the outcome tallies so the caller can render one summary. */
function createRunner(root, out, deadline, deadlineMs) {
  const state = { run: '', failed: '', failCount: 0, notRun: '', notRunCount: 0, timedOut: false, missing: [] };

  const launch = (command, args) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return { error: { code: 'ETIMEDOUT' } };
    return spawnSync(command, args, { cwd: root, stdio: 'ignore', shell: false, timeout: remaining });
  };

  const record = (name, command, result) => {
    out.push(`Running: ${name}`);
    state.run += ` ${name}`;
    if (!result.error && result.status === 0) {
      out.push(`  PASS: ${name}`);
      return;
    }
    // A spawn error means the check gave no verdict; a non-zero exit is the verdict.
    if (result.error) {
      const code = result.error.code;
      if (code === 'ETIMEDOUT') {
        state.timedOut = true;
        out.push(`  DID NOT FINISH: ${name} (ship-check deadline of ${Math.round(deadlineMs / 1000)} s reached)`);
      } else if (code === 'ENOENT') {
        state.missing.push(path.basename(command));
        out.push(`  COULD NOT RUN: ${name} (${path.basename(command)} not found)`);
      } else {
        out.push(`  COULD NOT RUN: ${name} (${code || result.error.message || 'spawn error'})`);
      }
      state.notRun += ` ${name}`;
      state.notRunCount += 1;
      return;
    }
    out.push(`  FAIL: ${name}`);
    state.failed += ` ${name}`;
    state.failCount += 1;
  };

  /** Run and report; a missing executable means the check could not run. */
  const runCheck = (name, command, args) => record(name, command, launch(command, args));

  /** Run and report, unless the tool is not installed — then return false for the caller's SKIP. */
  const runIfInstalled = (name, command, args) => {
    const result = launch(command, args);
    if (isMissingExecutable(result)) return false;
    record(name, command, result);
    return true;
  };

  return { state, runCheck, runIfInstalled };
}

const localBin = (root, name) => path.join(root, 'node_modules', '.bin', name);

function nodeChecks(root, scope, out, { runCheck }) {
  out.push('Detected: Node.js project', '');
  const pkg = readPackage(root) || {};
  const scripts = pkg.scripts || {};
  const jsFiles = scope.files.filter((f) => JS_FILE.test(f));

  const eslint = localBin(root, 'eslint');
  if (scope.rangeKnown && jsFiles.length && fs.existsSync(eslint) && ESLINT_CONFIG.some((c) => exists(root, c))) {
    runCheck(`eslint (${jsFiles.length} changed file${jsFiles.length === 1 ? '' : 's'})`, eslint, jsFiles);
  } else if (scripts.lint) {
    runCheck('npm run lint (project-wide: no per-file linter found)', 'npm', ['run', 'lint']);
  } else {
    out.push('SKIP: No lint script in package.json');
  }

  const testScript = String(scripts.test || '');
  if (!scope.rangeKnown) out.push('Tests did not run: the commits this action ships could not be determined (no upstream or origin/HEAD).');
  else if (/\bvitest\b/.test(testScript) && fs.existsSync(localBin(root, 'vitest'))) runCheck('vitest related', localBin(root, 'vitest'), ['related', '--run', '--passWithNoTests', ...scope.files]);
  else if (/\bjest\b/.test(testScript) && fs.existsSync(localBin(root, 'jest'))) runCheck('jest --findRelatedTests', localBin(root, 'jest'), ['--findRelatedTests', '--passWithNoTests', ...scope.files]);
  else out.push(testScript ? NO_RELATED_TESTS : 'SKIP: No test script in package.json');

  if (exists(root, 'tsconfig.json')) runCheck('tsc --noEmit', 'npx', ['tsc', '--noEmit']);
  else out.push('SKIP: No tsconfig.json found');
}

function pythonChecks(root, scope, out, { runIfInstalled }) {
  out.push('Detected: Python project', '');
  const pyFiles = scope.rangeKnown ? scope.files.filter((f) => PY_FILE.test(f)) : ['.'];
  if (!pyFiles.length) out.push('SKIP: No changed Python files to lint');
  else if (!runIfInstalled('ruff check', 'ruff', ['check', ...pyFiles]) && !runIfInstalled('flake8', 'flake8', pyFiles)) {
    out.push('SKIP: No Python linter found (ruff or flake8)');
  }
  out.push(NO_RELATED_TESTS);
}

function swiftChecks(root, scope, out, { runCheck, runIfInstalled }) {
  out.push('Detected: Swift project', '');
  const swiftFiles = scope.rangeKnown ? scope.files.filter((f) => SWIFT_FILE.test(f)) : [];
  if (!scope.rangeKnown) {
    if (!runIfInstalled('swiftlint', 'swiftlint', [])) out.push('SKIP: swiftlint not installed');
  } else if (!swiftFiles.length) out.push('SKIP: No changed Swift files to lint');
  else if (!runIfInstalled('swiftlint', 'swiftlint', ['lint', ...swiftFiles])) out.push('SKIP: swiftlint not installed');
  runCheck('swift build', 'swift', ['build']);
  out.push(NO_RELATED_TESTS);
}

/**
 * `{ exit, stdout, stderr, outcome, cause }` for the whole block; outcome is `passed`, `failed`
 * or `could_not_run`.
 * @param {string} root
 * @param {{ files: string[], rangeKnown: boolean }} scope
 * @param {{ deadlineMs?: number }} [opts]
 */
function runPreShipChecks(root, scope, { deadlineMs = DEFAULT_DEADLINE_MS } = {}) {
  const out = ['=== Pre-Ship Checks ===', ''];
  if (scope.rangeKnown && scope.files.length === 0) {
    out.push('No changed files: nothing to lint or test.');
    return { exit: 0, stdout: out, stderr: [], outcome: 'passed', cause: '' };
  }
  out.push(scope.rangeKnown ? `Changed files: ${scope.files.length}` : 'Changed files: unknown (lint and type-check run project-wide)', '');
  const runner = createRunner(root, out, Date.now() + deadlineMs, deadlineMs);
  const { state } = runner;

  if (exists(root, 'package.json')) nodeChecks(root, scope, out, runner);
  if (exists(root, 'Package.swift')) swiftChecks(root, scope, out, runner);
  if (exists(root, 'pyproject.toml') || exists(root, 'setup.py') || exists(root, 'pytest.ini')) pythonChecks(root, scope, out, runner);

  out.push('', '=== Summary ===', `Checks run:${state.run}`);
  if (state.failCount > 0) {
    const stderr = [`PRE-SHIP BLOCKED:${state.failed} failed`];
    if (state.notRunCount > 0) stderr.push(`Also gave no verdict:${state.notRun}`);
    return { exit: 2, stdout: out, stderr, outcome: 'failed', cause: 'check_failed' };
  }
  if (state.notRunCount > 0) {
    const cause = state.timedOut ? 'timeout' : state.missing.length ? 'missing_tool' : 'spawn_error';
    const stderr = [`PRE-SHIP COULD NOT RUN:${state.notRun} gave no verdict, so the change is unverified.`];
    if (state.timedOut) stderr.push(`A check did not finish within the ship-check deadline of ${Math.round(deadlineMs / 1000)} s.`);
    if (state.missing.length) stderr.push(`Not found: ${[...new Set(state.missing)].join(', ')}.`);
    return { exit: 2, stdout: out, stderr, outcome: 'could_not_run', cause };
  }
  out.push('PRE-SHIP PASS: All checks passed. Ready to ship.');
  return { exit: 0, stdout: out, stderr: [], outcome: 'passed', cause: '' };
}

module.exports = { isMissingExecutable, runPreShipChecks, NO_RELATED_TESTS };
