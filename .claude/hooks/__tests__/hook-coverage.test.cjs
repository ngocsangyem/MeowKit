// Every Claude Code hook behaviour says what it becomes on Codex and Cursor.
//
// A handler added to handlers.json without a coverage row fails here, so the gap between
// runtimes is written down when it opens rather than discovered later.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HOOKS = path.resolve(__dirname, '..');
const ROOT = path.resolve(HOOKS, '../..');
const coverage = JSON.parse(fs.readFileSync(path.join(HOOKS, 'hook-coverage.json'), 'utf8'));
const handlersFile = JSON.parse(fs.readFileSync(path.join(HOOKS, 'handlers.json'), 'utf8'));
const handlers = Array.isArray(handlersFile) ? handlersFile : handlersFile.handlers;
const closure = JSON.parse(fs.readFileSync(path.join(HOOKS, 'core-closure.json'), 'utf8'));

const RUNTIMES = ['codex', 'cursor'];
const BUNDLE_ROOT = {
  codex: 'packages/mewkit/src/migrate/modules/codex/root',
  cursor: 'packages/mewkit/src/migrate/modules/cursor/root',
};

test('every handler in handlers.json has exactly one coverage row', () => {
  const names = [...new Set(handlers.map((h) => h.toggleKey))].sort();
  assert.deepEqual(Object.keys(coverage.handlers).sort(), names);
});

test('every handler row gives a known status per runtime and a reason', () => {
  for (const [name, row] of Object.entries(coverage.handlers)) {
    for (const runtime of RUNTIMES) assert.ok(coverage.statuses.includes(row[runtime]), `${name}.${runtime}`);
    assert.ok(typeof row.reason === 'string' && row.reason.trim(), `${name} needs a reason`);
  }
});

test('every shared behaviour is classified, and a ported one names a hook that exists', () => {
  const behaviours = [...Object.keys(closure.behaviours), 'session-context'].sort();
  assert.deepEqual(Object.keys(coverage.safety).sort(), behaviours);
  for (const [name, row] of Object.entries(coverage.safety)) {
    for (const runtime of RUNTIMES) {
      const entry = row[runtime];
      assert.ok(coverage.statuses.includes(entry.status), `${name}.${runtime}`);
      if (entry.status === 'not-ported') {
        assert.ok(entry.reason && entry.reason.trim(), `${name}.${runtime} needs a reason`);
        continue;
      }
      const file = entry.where.split(' ')[0];
      assert.ok(fs.existsSync(path.join(ROOT, BUNDLE_ROOT[runtime], file)), `${name}.${runtime}: ${file} is missing`);
    }
  }
});

test('the node-missing behaviour is recorded for every runtime', () => {
  for (const runtime of ['claude-code', ...RUNTIMES]) assert.ok(coverage.nodeMissing[runtime], runtime);
});
