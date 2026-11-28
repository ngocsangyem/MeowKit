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

// Every runtime the adapters know that has a hook surface, read from the adapters' own table,
// so a new adapter without a coverage column fails here instead of shipping unrecorded.
const SURFACE = JSON.parse(fs.readFileSync(path.join(ROOT, 'crates/mewkit-adapters/src/surface_table.json'), 'utf8'));
const RUNTIMES = SURFACE.runtimes.filter((r) => r.kinds && r.kinds.hooks && r.name !== 'claude-code').map((r) => r.name);
// Where each runtime's installed files come from. Pi and OMP run the scripts in the tree they
// share with Codex, from a module in their own folder.
const BUNDLE_ROOTS = {
  codex: ['kit/overlays/codex/files'],
  cursor: ['kit/overlays/cursor/files'],
  grok: ['kit/overlays/grok/files'],
  pi: ['kit/overlays/agents/files', 'kit/overlays/pi/files'],
  omp: ['kit/overlays/agents/files', 'kit/overlays/omp/files'],
  antigravity: ['kit/overlays/antigravity/files'],
};
// The hook entry points each bundle ships: scripts a host or a runtime module runs, not libraries.
const ENTRY_DIRS = {
  codex: ['kit/overlays/codex/files/.codex/hooks'],
  cursor: ['kit/overlays/cursor/files/.cursor/hooks'],
  grok: ['kit/overlays/grok/files/.grok/meowkit/hooks'],
  pi: ['kit/overlays/agents/files/.agents/meowkit/hooks', 'kit/overlays/pi/files/.pi/extensions'],
  omp: ['kit/overlays/agents/files/.agents/meowkit/hooks', 'kit/overlays/omp/files/.omp/hooks/pre', 'kit/overlays/omp/files/.omp/hooks/post'],
  antigravity: ['kit/overlays/antigravity/files/.agents/meowkit-antigravity/hooks'],
};

// The always-on file every install writes; a projection into it has no hook script to point at.
const INSTALL_WRITTEN = ['AGENTS.md'];

/** The installed path (first word of a `where`) exists in one of the runtime's bundles, or is a file every install writes. */
function whereExists(runtime, where) {
  const file = where.split(' ')[0];
  return INSTALL_WRITTEN.includes(file) || BUNDLE_ROOTS[runtime].some((root) => fs.existsSync(path.join(ROOT, root, file)));
}

/** `runtime: path` for each hook entry a bundle ships that no coverage row names. */
function unrecordedEntries(doc) {
  const named = [];
  for (const row of Object.values(doc.safety || {})) for (const entry of Object.values(row)) named.push(entry.where || '', entry.note || '');
  for (const row of Object.values(doc.handlers || {})) named.push(...Object.values(row.where || {}));
  const out = [];
  for (const runtime of RUNTIMES) {
    const extra = Object.keys((doc.runtimeOnly || {})[runtime] || {});
    for (const dir of ENTRY_DIRS[runtime] || []) {
      const abs = path.join(ROOT, dir);
      if (!fs.existsSync(abs)) continue;
      for (const name of fs.readdirSync(abs)) {
        if (!/\.(cjs|mjs|js|ts)$/.test(name)) continue;
        const rel = path.relative(BUNDLE_ROOTS[runtime].find((r) => dir.startsWith(r)), path.join(dir, name)).split(path.sep).join('/');
        if (!named.some((text) => text.includes(rel)) && !extra.includes(rel)) out.push(`${runtime}: ${rel}`);
      }
    }
  }
  return out;
}

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
      assert.ok(whereExists(runtime, entry.where), `${name}.${runtime}: ${file} is missing`);
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

test('every runtime with a hook surface has a bundle and entry list here', () => {
  for (const runtime of RUNTIMES) {
    assert.ok(BUNDLE_ROOTS[runtime] && ENTRY_DIRS[runtime], `${runtime}: add its bundle and hook folders to this test and a column to hook-coverage.json`);
  }
});

test('a handler cell other than not-ported names a hook that exists; an unverified one cites its source', () => {
  for (const [name, row] of Object.entries(coverage.handlers)) {
    for (const runtime of RUNTIMES) {
      if (row[runtime] === 'not-ported') continue;
      const where = row.where && row.where[runtime];
      assert.ok(typeof where === 'string' && where.trim(), `${name}.${runtime} is ${row[runtime]} but names no hook in where.${runtime}`);
      assert.ok(whereExists(runtime, where), `${name}.${runtime}: ${where.split(' ')[0]} is missing`);
      if (row[runtime] === 'unverified') assert.ok(row.notes && row.notes[runtime] && row.notes[runtime].trim(), `${name}.${runtime} needs notes.${runtime} citing its source`);
    }
    for (const runtime of Object.keys(row.where || {})) {
      assert.notEqual(row[runtime], 'not-ported', `${name}.${runtime} names a hook but says not-ported`);
    }
  }
});

test('every hook a runtime bundle ships is recorded', () => {
  assert.deepEqual(unrecordedEntries(coverage), []);
});

test('the shipped-hook rule catches a hook no row names', () => {
  const doc = structuredClone(coverage);
  delete doc.runtimeOnly.cursor['.cursor/hooks/mcp-gate.cjs'];
  assert.deepEqual(unrecordedEntries(doc), ['cursor: .cursor/hooks/mcp-gate.cjs']);
});
