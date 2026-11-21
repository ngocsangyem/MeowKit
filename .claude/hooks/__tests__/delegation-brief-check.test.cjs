// The delegation brief check is advisory: it names a missing Goal or Return label once,
// stays silent on a complete brief, and never copies the brief into its output or trace.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const handler = require('../handlers/delegation-brief-check.cjs');

const MARKER = 'rotate-the-zebra-key-7741';

function run(prompt) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-check-'));
  const result = handler({ root, tool_input: { prompt } });
  const log = path.join(root, '.meowkit', 'telemetry', 'trace-log.jsonl');
  const lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : [];
  return { result, lines, root };
}

test('names the missing label when Return is absent', () => {
  const { result, lines } = run(`Goal: fix the parser\nContext: ${MARKER}`);
  assert.match(result.context, /no Return: label/);
  assert.equal(lines.length, 1);
  const record = JSON.parse(lines[0]);
  assert.equal(record.event, 'delegation_brief_check');
  assert.deepEqual(record.data, { goal: true, return: false });
});

test('names both labels when neither is present', () => {
  const { result } = run('Please look at the parser');
  assert.match(result.context, /no Goal: and Return: label/);
});

test('is silent when both labels are present, and still records the check', () => {
  const { result, lines } = run('**Goal:** fix the parser\n- Return: a one-line summary');
  assert.equal(result, '');
  assert.deepEqual(JSON.parse(lines[0]).data, { goal: true, return: true });
});

test('never echoes the brief text in the output or the trace', () => {
  const { result, lines } = run(`Context only: ${MARKER}`);
  assert.ok(!JSON.stringify(result).includes(MARKER));
  assert.ok(!lines.join('\n').includes(MARKER));
});

test('does nothing when the payload carries no prompt', () => {
  const { result, lines } = run(undefined);
  assert.equal(result, '');
  assert.equal(lines.length, 0);
});

test('a check runs under 50 ms', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-check-'));
  handler({ root, tool_input: { prompt: 'warm' } });
  const start = process.hrtime.bigint();
  handler({ root, tool_input: { prompt: 'Goal: x\nReturn: y' } });
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(ms < 50, `took ${ms.toFixed(1)} ms`);
});
