#!/usr/bin/env node
'use strict';
// validate-gate-2.cjs — bundled copy of the kit's gate helper, self-contained.
//
// Usage: node validate-gate-2.cjs <path-to-verdict>   ·   cat verdict.md | node validate-gate-2.cjs -
// Exit:  0 ready · 1 blocked
//
// A provider bundle ships no shared hook library, and a require across skill
// directories would couple two trees that are installed independently — so the
// logic below is inlined rather than imported. It is generated from the kit's
// module of the same name; edit that one and regenerate.

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

const input = process.argv[2] || '-';
const result = input === '-'
  ? validateGate2({ input, content: require('node:fs').readFileSync(0, 'utf8') })
  : validateGate2({ input });
if (result.stdout.length) process.stdout.write(`${result.stdout.join('\n')}\n`);
if (result.stderr.length) process.stderr.write(`${result.stderr.join('\n')}\n`);
process.exit(result.exit);
