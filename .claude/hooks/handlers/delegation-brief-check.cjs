'use strict';
// delegation-brief-check.cjs — PreToolUse handler on the subagent tool: note when a
// delegation brief lacks the `Goal:` or `Return:` label of the delegate template.
//
// ADVISORY by contract. It never blocks and never repeats the brief: the one line it
// returns says which label is absent, and the trace record holds two booleans, so no
// prompt text reaches the model a second time or the committed trace history.
// Silent when both labels are present. Off switch: `hooks.delegation-brief-check: false`.

const { appendTrace } = require('../lib/trace-log.cjs');

// A label sits at the start of a line, optionally after list or emphasis marks.
const labelPattern = (name) => new RegExp(`(^|\\n)[ \\t>*#_-]*${name}[*_]*[ \\t]*:`, 'i');
const GOAL = labelPattern('Goal');
const RETURN = labelPattern('Return');

module.exports = function delegationBriefCheck(ctx) {
  const prompt = ctx.tool_input?.prompt;
  if (typeof prompt !== 'string') return '';

  const goal = GOAL.test(prompt);
  const hasReturn = RETURN.test(prompt);

  try {
    appendTrace({ root: ctx.root, event: 'delegation_brief_check', payload: JSON.stringify({ goal, return: hasReturn }) });
  } catch {
    // A failed trace write must not cost the advisory its turn.
  }

  if (goal && hasReturn) return '';
  const missing = [!goal && 'Goal:', !hasReturn && 'Return:'].filter(Boolean).join(' and ');
  return { context: `This delegation brief has no ${missing} label; the delegate template names Goal and Return.` };
};
