'use strict';
// preship-checks.cjs — the build, lint and test block the ship guard runs.
//
// These are speed trade-offs, not gates: they are skipped in the fast profile
// while the structural ship proof and the store lint are not. Each check is
// detected before it is reported, and an absent tool is a named SKIP rather
// than a silent pass or a false failure.
//
// Tool discovery is done by attempting the spawn and reading a
// "no such executable" error, not by scanning the search path. Two reasons:
// reading the path would add an environment variable to the closed set this
// guard is allowed to consult, and the probe would be a second answer that can
// disagree with the launch that follows it.
//
// Child output is discarded on purpose. Only the pass/fail verdict is useful
// here, and forwarding a test runner's full output would bury the summary the
// model has to act on.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function exists(root, rel) {
  try { return fs.statSync(path.join(root, rel)).isFile(); } catch { return false; }
}

/**
 * Is `name` an npm script? Matched as a quoted token anywhere in the manifest,
 * which is how the shell form read it — a stricter parse would change which
 * projects run which checks.
 */
function hasNpmScript(root, name) {
  if (!exists(root, 'package.json')) return false;
  try { return fs.readFileSync(path.join(root, 'package.json'), 'utf8').includes(`"${name}"`); } catch { return false; }
}

/** True when the failure was "this executable does not exist" rather than a check result. */
const isMissingExecutable = (result) => Boolean(result.error && result.error.code === 'ENOENT');

/** Collects output lines and the failure tally so the caller can render one summary. */
function createRunner(root, out) {
  const state = { run: '', failed: '', failCount: 0 };

  const record = (name, result) => {
    out.push(`Running: ${name}`);
    state.run += ` ${name}`;
    if (!result.error && result.status === 0) {
      out.push(`  PASS: ${name}`);
      return;
    }
    out.push(`  FAIL: ${name}`);
    state.failed += ` ${name}`;
    state.failCount += 1;
  };

  const launch = (command, args) =>
    spawnSync(command, args, { cwd: root, stdio: 'ignore', shell: false });

  /** Run and report. A missing executable still counts as a failure, as it did before. */
  const runCheck = (name, command, args) => record(name, launch(command, args));

  /**
   * Run and report, unless the tool is simply not installed — then hand the
   * decision back so the caller can emit its own SKIP wording.
   */
  const runIfInstalled = (name, command, args) => {
    const result = launch(command, args);
    if (isMissingExecutable(result)) return false;
    record(name, result);
    return true;
  };

  return { state, runCheck, runIfInstalled };
}

function nodeChecks(root, out, runCheck) {
  out.push('Detected: Node.js project', '');
  if (hasNpmScript(root, 'test')) runCheck('npm test', 'npm', ['test']);
  else out.push('SKIP: No test script in package.json');

  if (hasNpmScript(root, 'lint')) runCheck('npm run lint', 'npm', ['run', 'lint']);
  else out.push('SKIP: No lint script in package.json');

  if (exists(root, 'tsconfig.json')) runCheck('tsc --noEmit', 'npx', ['tsc', '--noEmit']);
  else out.push('SKIP: No tsconfig.json found');
}

function swiftChecks(root, out, runCheck, runIfInstalled) {
  out.push('Detected: Swift project', '');
  runCheck('swift test', 'swift', ['test']);
  if (!runIfInstalled('swiftlint', 'swiftlint', [])) out.push('SKIP: swiftlint not installed');
}

function pythonChecks(root, out, runIfInstalled) {
  out.push('Detected: Python project', '');
  if (!runIfInstalled('pytest', 'pytest', [])) out.push('SKIP: pytest not installed');

  if (runIfInstalled('ruff check', 'ruff', ['check', '.'])) return;
  if (runIfInstalled('flake8', 'flake8', [])) return;
  out.push('SKIP: No Python linter found (ruff or flake8)');
}

/** `{ exit, stdout, stderr }` for the whole block. */
function runPreShipChecks(root) {
  const out = ['=== Pre-Ship Checks ===', ''];
  const { state, runCheck, runIfInstalled } = createRunner(root, out);

  if (exists(root, 'package.json')) nodeChecks(root, out, runCheck);
  if (exists(root, 'Package.swift')) swiftChecks(root, out, runCheck, runIfInstalled);
  if (exists(root, 'pyproject.toml') || exists(root, 'setup.py') || exists(root, 'pytest.ini')) {
    pythonChecks(root, out, runIfInstalled);
  }

  out.push('', '=== Summary ===', `Checks run:${state.run}`);
  if (state.failCount > 0) {
    return { exit: 2, stdout: out, stderr: [`PRE-SHIP BLOCKED:${state.failed} failed`] };
  }
  out.push('PRE-SHIP PASS: All checks passed. Ready to ship.');
  return { exit: 0, stdout: out, stderr: [] };
}

module.exports = { hasNpmScript, isMissingExecutable, runPreShipChecks };
