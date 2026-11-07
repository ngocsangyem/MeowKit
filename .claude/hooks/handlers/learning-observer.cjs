'use strict';
// learning-observer.cjs — per-file edit ledger, and the canonical edit record.
//
// The ledger is self-read to compute the edit count, which is the one field the
// trace record carries that cannot be derived from a single event. Churn (the
// same file edited repeatedly) is re-derivable downstream from that count, so
// no separate churn record is written unless debugging asks for one.

const fs = require('node:fs');
const path = require('node:path');

const { appendTrace } = require('../lib/trace-log.cjs');

const STATE_REL = 'session-state/learning-observer.jsonl';
const CHURN_THRESHOLD = 3;

/** How many times this ledger already names the file. */
function priorEdits(stateFile, filePath) {
  try {
    const needle = `"file":"${filePath}"`;
    return fs.readFileSync(stateFile, 'utf8').split('\n').filter((l) => l.includes(needle)).length;
  } catch {
    return 0;
  }
}

module.exports = function learningObserver(ctx) {
  // The profile selects speed trade-offs; a ledger write is one of them.
  const profile = process.env.MEOWKIT_HOOK_PROFILE || process.env.MEOW_HOOK_PROFILE || 'standard';
  if (profile === 'fast') return null;

  // The path as the payload spelled it, because the ledger is keyed on it and a
  // resolved spelling would start a second series for the same file.
  const filePath = (ctx.hookInput && ctx.hookInput.filePath) || 'unknown';
  const stateFile = path.join(ctx.root, STATE_REL);
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  } catch {
    return null;
  }

  const count = priorEdits(stateFile, filePath) + 1;
  try {
    fs.appendFileSync(stateFile, `{"type":"edit","file":"${filePath}","count":${count},"ts":"${ts}"}\n`);
    if (process.env.MEOWKIT_HOOK_DEBUG === '1' && count >= CHURN_THRESHOLD) {
      fs.appendFileSync(stateFile, `{"type":"churn","file":"${filePath}","count":${count},"ts":"${ts}"}\n`);
    }
  } catch {
    // A lost ledger line costs a count, not the edit.
  }

  if (filePath !== 'unknown') {
    appendTrace({ root: ctx.root, event: 'file_edited', payload: JSON.stringify({ file: filePath, edit_count: count }) });
  }
  return null;
};
