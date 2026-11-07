#!/usr/bin/env node
'use strict';
// pre-implement.cjs — refuse to start implementing until a failing test exists.
//
//   node pre-implement.cjs <feature-name-or-file-path>
//
// Invoked with arguments by the agent that is about to write code, not by an
// event, so it is never routed through the observer dispatcher — and must not
// be. The dispatcher is fail-open by contract; this check is fail-CLOSED once
// strict mode is on, which is the whole reason someone turned it on.
//
// Default is off. With strict mode on and the detection helper missing, it
// blocks rather than waving through: the user asked for the gate, so "cannot
// verify" is not "proceed".

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const HELPER_REL = '.claude/hooks/lib/tdd-detect.cjs';

const out = (line) => process.stdout.write(`${line}\n`);
const err = (line) => process.stderr.write(`${line}\n`);

function loadTddDetect() {
  const helper = path.join(root, HELPER_REL);
  try {
    if (!fs.statSync(helper).isFile()) throw new Error('not a file');
    return require(helper).isTddEnabled;
  } catch {
    err(`[tdd] WARN: tdd-detect.cjs missing at ${helper}`);
    if (process.env.MEOWKIT_TDD === '1') {
      err('BLOCKED: TDD helper missing, cannot verify strict mode');
      process.exit(1);
    }
    process.exit(0);
  }
  return null;
}

/** Test files that name the feature, searched where tests conventionally live. */
function findTests(feature) {
  const matches = [];
  const scan = (dir, filter) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isFile() || !filter(entry.name)) continue;
      const file = path.join(String(entry.parentPath ?? dir), entry.name);
      try {
        if (fs.readFileSync(file, 'utf8').includes(feature)) matches.push(file);
      } catch {
        // Unreadable file: not evidence either way.
      }
    }
  };
  for (const dir of ['__tests__', 'tests']) scan(path.join(root, dir), () => true);
  if (matches.length === 0) {
    scan(root, (name) => /\.(test|spec)\.(ts|js)$|\.test\.(swift|py)$/.test(name));
  }
  return matches;
}

/** The project's own runner, detected the same way the ship checks detect it. */
function runTests() {
  const manifest = path.join(root, 'package.json');
  if (fs.existsSync(manifest)) {
    const pkg = fs.readFileSync(manifest, 'utf8');
    if (pkg.includes('"vitest"')) return spawnSync('npx', ['vitest', 'run'], { cwd: root, stdio: 'inherit' });
    if (pkg.includes('"jest"')) return spawnSync('npx', ['jest'], { cwd: root, stdio: 'inherit' });
    if (pkg.includes('"test"')) return spawnSync('npm', ['test'], { cwd: root, stdio: 'inherit' });
    out('No test runner detected in package.json.');
    return { status: 0 };
  }
  if (fs.existsSync(path.join(root, 'Package.swift'))) return spawnSync('swift', ['test'], { cwd: root, stdio: 'inherit' });
  for (const marker of ['pyproject.toml', 'setup.py', 'pytest.ini']) {
    if (fs.existsSync(path.join(root, marker))) return spawnSync('pytest', [], { cwd: root, stdio: 'inherit' });
  }
  out('No recognized test runner found.');
  return { status: 0 };
}

const isTddEnabled = loadTddDetect();
if (!isTddEnabled({ root }).enabled) process.exit(0);

const feature = process.argv[2] || '';
if (!feature) {
  out('Usage: pre-implement.cjs <feature-name-or-file-path>');
  process.exit(1);
}

// Strip the extension and any character that could inject terminal escapes into
// the lines printed below.
const featureName = path.basename(feature).replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9._-]/g, '');
out(`Checking for failing tests for: ${featureName}`);

if (findTests(featureName).length === 0) {
  err(`BLOCKED: TDD mode is ON but no test file found for [${featureName}].`);
  err('Write failing tests first (Phase 2), or unset MEOWKIT_TDD / drop --tdd to proceed without TDD gate.');
  process.exit(1);
}

out(`Found test files referencing ${featureName}. Running test suite...`);
const result = runTests();
if (!result.error && result.status === 0) {
  // A green suite means the tests do not describe the new behavior yet, so
  // there is nothing for the implementation to turn green.
  err('BLOCKED: TDD mode requires failing tests before implementation.');
  err("Your tests are passing — they don't test new behavior yet.");
  err('Unset MEOWKIT_TDD or drop --tdd to proceed without TDD gate.');
  process.exit(1);
}
out('PASS: Failing tests confirmed. Proceeding to implementation.');
process.exit(0);
