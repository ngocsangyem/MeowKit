'use strict';
// plan-state-sync.cjs — at stop, bring changed plans' derived state up to date with their
// checkboxes.
//
// Always on (not tied to the opt-in completion check): the state it writes is derived, so
// writing it never needs a decision. It never blocks and never asks for another turn. It
// prints one line, shown to the user, only when it changed something or a plan is complete
// and waiting to be archived. Rule and limits: lib/core/plan-state-sync.cjs.

const { syncChangedPlans, summaryLine } = require('../lib/core/plan-state-sync.cjs');

module.exports = function planStateSync(ctx) {
  const line = summaryLine(syncChangedPlans(ctx.root, { write: true }));
  if (!line) return null;
  return { stdout: `${JSON.stringify({ systemMessage: line })}\n`, feedback: true };
};
