// The receipt helper's command line, which `mewkit plan approve` runs.
//
// The helper used to have no command-line entry: run as a script it loaded, did nothing and
// exited 0, and the caller printed "stamped" over an unchanged plan. These tests run the real
// file in a child process and check the plan on disk, not the message.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HELPER = path.resolve(__dirname, '../lib/approval-receipt.cjs');

function plan(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'receipt-cli-'));
  const file = path.join(dir, 'plan.md');
  fs.writeFileSync(file, content);
  return file;
}

const run = (...args) => spawnSync(process.execPath, [HELPER, ...args], { encoding: 'utf8' });

test('stamp writes an approval block bound to the plan body and exits 0', () => {
  const file = plan('---\ntitle: demo\n---\n\n# Plan\nbody\n');
  const result = run('stamp', file, 'tester');
  assert.equal(result.status, 0, result.stderr);
  const written = fs.readFileSync(file, 'utf8');
  assert.match(written, /^approval:\n {2}approved_by: tester\n {2}date: \d{4}-\d{2}-\d{2}\n {2}plan_hash: [0-9a-f]{64}$/m);
  assert.equal(run('verify', file).status, 0);
});

test('stamp on a plan without frontmatter exits non-zero and leaves the file unchanged', () => {
  const original = '# Plan\nbody\n';
  const file = plan(original);
  const result = run('stamp', file, 'tester');
  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
});

test('verify reports a stale receipt after the body changes', () => {
  const file = plan('---\ntitle: demo\n---\nbody\n');
  assert.equal(run('stamp', file).status, 0);
  fs.appendFileSync(file, 'new scope\n');
  const result = run('verify', file);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stale/);
});

test('an unknown command or missing file argument is a usage error, never success', () => {
  assert.equal(run('approve').status, 2);
  assert.equal(run().status, 2);
  assert.notEqual(run('verify', path.join(os.tmpdir(), 'no-such-plan.md')).status, 0);
});
