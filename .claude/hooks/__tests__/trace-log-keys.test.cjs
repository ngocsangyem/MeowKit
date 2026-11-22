// The optional trace keys: skill, session_id and signal are written only when known,
// sit before `data`, and an unknown signal token is dropped rather than stored.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildRecord } = require('../lib/trace-log.cjs');

const base = { event: 'x', payload: '', model: '', runId: '', env: {}, now: new Date(0) };

test('unknown keys stay absent and the record keeps its original shape', () => {
  const keys = Object.keys(buildRecord(base));
  assert.deepEqual(keys, ['schema_version', 'ts', 'event', 'run_id', 'harness_version', 'model', 'density', 'data']);
});

test('skill, session and a known signal are written before data', () => {
  const record = buildRecord({ ...base, skill: 'fix', sessionId: 's1', signal: 'ship_check_result' });
  assert.deepEqual(Object.keys(record).slice(-4), ['skill', 'session_id', 'signal', 'data']);
  assert.equal(record.signal, 'ship_check_result');
});

test('a signal that is not in the closed set is dropped', () => {
  assert.equal('signal' in buildRecord({ ...base, signal: 'it went badly' }), false);
});
