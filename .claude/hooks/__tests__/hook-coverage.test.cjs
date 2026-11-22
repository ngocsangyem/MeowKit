// Every Claude Code hook behaviour says what it becomes on each other runtime.
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

const RUNTIMES = ['codex', 'cursor', 'grok', 'pi', 'omp', 'antigravity'];
const BUNDLE_ROOT = {
  codex: 'kit/overlays/codex/files',
  cursor: 'kit/overlays/cursor/files',
  grok: 'kit/overlays/grok/files',
  // Pi and OMP run the guard in the tree they share with Codex.
  pi: 'kit/overlays/agents/files',
  omp: 'kit/overlays/agents/files',
  antigravity: 'kit/overlays/antigravity/files',
};

// Runtimes whose guards were written from documentation. A row there says `ported` only
// with a record of the live run that showed it deny; until then it says `unverified`.
const PROBE_REQUIRED = ['antigravity'];

/** Each `runtime.behaviour` row that claims `ported` without a recorded denial. */
function portedWithoutProbe(doc) {
  const out = [];
  for (const [name, row] of Object.entries(doc.safety || {})) {
    for (const runtime of PROBE_REQUIRED) {
      const entry = row[runtime];
      if (!entry || entry.status !== 'ported') continue;
      const probe = entry.probe;
      const recorded = probe && typeof probe === 'object'
        && probe.observed === 'deny'
        && typeof probe.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(probe.date)
        && typeof probe.by === 'string' && probe.by.trim();
      if (!recorded) out.push(`${name}.${runtime}`);
    }
  }
  return out;
}

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

test('a guard written from documentation is ported only with a recorded denial', () => {
  assert.deepEqual(portedWithoutProbe(coverage), []);
});

test('the probe rule refuses a ported row that has no probe record', () => {
  const doc = structuredClone(coverage);
  doc.safety.privacy.antigravity = { status: 'ported', where: doc.safety.privacy.antigravity.where };
  assert.deepEqual(portedWithoutProbe(doc), ['privacy.antigravity']);
  doc.safety.privacy.antigravity.probe = { date: '2026-11-22', observed: 'allow', by: 'maintainer' };
  assert.deepEqual(portedWithoutProbe(doc), ['privacy.antigravity'], 'a probe that saw no denial is not one');
  doc.safety.privacy.antigravity.probe.observed = 'deny';
  assert.deepEqual(portedWithoutProbe(doc), []);
});

test('an unverified row says where its documentation came from', () => {
  for (const [name, row] of Object.entries(coverage.safety)) {
    for (const runtime of RUNTIMES) {
      const entry = row[runtime];
      if (entry.status !== 'unverified') continue;
      assert.ok(entry.note && /https?:\/\//.test(entry.note), `${name}.${runtime} needs a note citing its source`);
    }
  }
});

test('the node-missing behaviour is recorded for every runtime', () => {
  for (const runtime of ['claude-code', ...RUNTIMES]) assert.ok(coverage.nodeMissing[runtime], runtime);
});
