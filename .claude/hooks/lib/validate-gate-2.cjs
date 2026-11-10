'use strict';
// validate-gate-2.cjs — does a review or security verdict carry a blocking state?
//
// The single parser for verdict text. The write guard, the Gate 2 structural
// check and the completion check all call THIS module, so "what counts as a
// FAIL" cannot drift between the places that ask.
//
// Returns `{ exit, stdout, stderr }` with line arrays rather than printing, so
// a hook can read the decision in-process while the thin CLI renders it. exit 0
// = ready, exit 1 = blocked.
//
// Matching is deliberately structural: only verdict states in a recognised
// shape count. Incidental prose such as "blocked by a flaky test" must not
// block a ship, so a bare word is never enough.

const fs = require('node:fs');

/**
 * Structured verdict states only: a `FAIL:`/`BLOCK:` line, a `Verdict: FAIL`
 * or `Verdict: BLOCK` declaration (the security agent's documented form), a
 * gate-block marker, or a markdown table cell holding FAIL or BLOCK.
 */
const FAIL_LINE = /^FAIL:|: FAIL|VERDICT[ \t]*:?[ \t]*(FAIL|BLOCK)|^BLOCK:|GATE.*BLOCK|^\|[^|]*\|[ \t]*(FAIL|BLOCK)[ \t]*\|/i;

/** Block when a side effect is announced and no user decision follows it. */
const SIDE_EFFECT_LINE = /^Side Effects Detected: Yes/;
const ADDENDUM_LINE = /User Decision Addendum|User selected:|Resumption point:/;

/** Count lines matching `re`, the way a line-oriented matcher would. */
function countLines(content, re) {
  return content.split('\n').filter((line) => re.test(line)).length;
}

/**
 * `input` names the verdict (used for the not-found message and to tell a
 * security verdict from a review one); `content`, when given, is used instead of
 * reading the file, which is how an in-process caller avoids a second read.
 */
function validateGate2({ input = '-', content = null } = {}) {
  const kind = /-security-verdict\.md$/.test(input) ? 'security' : 'review';
  let text = content;

  if (text === null) {
    try {
      if (!fs.statSync(input).isFile()) throw new Error('not a file');
      text = fs.readFileSync(input, 'utf8');
    } catch {
      return { exit: 1, stdout: [`GATE_2_BLOCKED: File not found: ${input}`], stderr: [] };
    }
  }

  const failCount = countLines(text, FAIL_LINE);
  const criticalMatch = text.match(/Critical \(([0-9]+)\)/i);
  const critical = criticalMatch ? Number(criticalMatch[1]) : 0;
  const sideEffects = countLines(text, SIDE_EFFECT_LINE);
  const addendum = sideEffects > 0 ? countLines(text, ADDENDUM_LINE) : 0;
  const scoreMatch = text.match(/[0-9]+(\.[0-9]+)?\/10/i);
  const score = scoreMatch ? scoreMatch[0].split('/')[0] : '0';

  let issues = '';
  if (failCount > 0) issues += ` has-FAIL-dimensions(${failCount})`;
  if (critical > 0) issues += ` critical-issues(${critical})`;
  if (sideEffects > 0 && addendum === 0) issues += ' side-effects-without-addendum';

  if (issues) {
    return {
      exit: 1,
      stdout: [`GATE_2_BLOCKED:${issues} — ${kind} verdict, score: ${score}/10`, 'Human approval required to override.'],
      stderr: [],
    };
  }
  return { exit: 0, stdout: [`GATE_2_READY — ${kind} verdict, score: ${score}/10, 0 critical, 0 FAIL`], stderr: [] };
}

module.exports = { validateGate2, FAIL_LINE };
