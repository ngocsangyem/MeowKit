// The ship check's related-tests step: a runner that relates no test to the change exits 0, which
// used to print `PASS: vitest related` though nothing ran. The runner's JSON report carries the
// test count, so zero tests is named as tests not run, a count above zero is shown on the PASS
// line, and a report that cannot be read keeps the plain PASS (the parse never invents a block).
//
// The stubs stand in for the project's own node_modules/.bin/vitest and jest: they write the
// report file named by --outputFile with the count given, or write nothing.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runPreShipChecks, ZERO_RELATED_TESTS } = require('../lib/preship-checks.cjs');

const skip = process.platform === 'win32' ? 'the stubs are sh scripts' : false;

function write(dir, rel, body, mode) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), body, mode ? { mode } : undefined);
}

/**
 * A project whose test script names `runner`, with a stub runner that reports `total` tests
 * (or writes no report when `total` is null) and exits `exit`.
 */
function project(runner, total, exit = 0) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'preship-zero-')));
  write(dir, 'package.json', JSON.stringify({ scripts: { test: runner } }));
  write(dir, 'src/a.js', 'module.exports = 1;\n');
  const report = total === null ? '' : `
for a in "$@"; do
  case "$a" in --outputFile=*) printf '{"numTotalTests":${total}}' > "\${a#--outputFile=}";; esac
done`;
  write(dir, `node_modules/.bin/${runner}`, `#!/bin/sh${report}\nexit ${exit}\n`, 0o755);
  return dir;
}

const run = (dir) => runPreShipChecks(dir, { files: ['src/a.js'], rangeKnown: true });

for (const [runner, name] of [['vitest', 'vitest related'], ['jest', 'jest --findRelatedTests']]) {
  test(`${runner}: zero related tests is named as not run, not printed as PASS`, { skip }, () => {
    const r = run(project(runner, 0));
    assert.equal(r.outcome, 'passed');
    assert.ok(r.stdout.includes(`  ${ZERO_RELATED_TESTS}`), r.stdout.join('\n'));
    assert.ok(!r.stdout.some((l) => l.includes(`PASS: ${name}`)), r.stdout.join('\n'));
  });

  test(`${runner}: related tests that ran show their count on the PASS line`, { skip }, () => {
    const r = run(project(runner, 3));
    assert.equal(r.outcome, 'passed');
    assert.ok(r.stdout.includes(`  PASS: ${name} (3 tests)`), r.stdout.join('\n'));
  });

  test(`${runner}: an unreadable report keeps the plain PASS`, { skip }, () => {
    const r = run(project(runner, null));
    assert.equal(r.outcome, 'passed');
    assert.ok(r.stdout.includes(`  PASS: ${name}`), r.stdout.join('\n'));
  });

  test(`${runner}: a failing run still fails, whatever the report says`, { skip }, () => {
    const r = run(project(runner, 0, 1));
    assert.equal(r.outcome, 'failed');
    assert.ok(r.stdout.includes(`  FAIL: ${name}`), r.stdout.join('\n'));
  });
}
