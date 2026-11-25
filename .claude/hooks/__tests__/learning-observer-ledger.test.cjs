// The learning observer's edit ledger is one JSON record per line, serialised rather than
// interpolated: a file path holding a quote, a backslash or a newline stays inside its own
// `file` field, cannot split a record or forge a second one, and is counted on its own.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const learningObserver = require('../handlers/learning-observer.cjs');

function ledger(root) {
  return fs.readFileSync(path.join(root, '.meowkit/state/learning-observer.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
}

test('a path with a quote, a backslash and a newline is recorded whole and counted on its own', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-')));
  const hostile = 'src/a","type":"churn","file":"src/b\\\n{"type":"edit","file":"src/b"}.ts';
  learningObserver({ root, hookInput: { filePath: hostile } });
  learningObserver({ root, hookInput: { filePath: 'src/b' } });
  learningObserver({ root, hookInput: { filePath: hostile } });
  const records = ledger(root);
  assert.equal(records.length, 3, 'one line per edit');
  assert.deepEqual(records.map((r) => [r.type, r.file, r.count]), [
    ['edit', hostile, 1],
    ['edit', 'src/b', 1],
    ['edit', hostile, 2],
  ]);
});
