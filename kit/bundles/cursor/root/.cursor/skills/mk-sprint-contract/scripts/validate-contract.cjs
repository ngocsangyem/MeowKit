#!/usr/bin/env node
'use strict';
// validate-contract.cjs — bundled copy of the kit's gate helper, self-contained.
//
// Usage: node validate-contract.cjs <path-to-contract.md>
// Exit:  0 valid · 1 schema failure (diagnostics on stderr) · 2 usage error
//
// A provider bundle ships no shared hook library, and a require across skill
// directories would couple two trees that are installed independently — so the
// logic below is inlined rather than imported. It is generated from the kit's
// module of the same name; edit that one and regenerate.

const fs = require('node:fs');

const REQUIRED_FIELDS = ['contract_schema_version', 'task', 'sprint', 'plan_ref', 'rubric_preset', 'status', 'rounds', 'created'];
const VALID_STATUS = ['draft', 'negotiating', 'signed', 'amended', 'closed'];
const VALID_PRESETS = ['frontend-app', 'backend-api', 'cli-tool', 'fullstack-product'];
const REQUIRED_SECTIONS = ['## Scope (In)', '## Scope (Out)', '## Acceptance Criteria', '## Rubric Bindings', '## Negotiation Log'];
const AC_HEADING = /^### \[AC-[0-9]+\]/;

/** Instruction-like text in a criterion is an injection attempt, not a criterion. */
const INJECTION = /ignore (previous|above) instructions|you are now|disregard your rules|new system prompt/i;

const MIN_ACS = 5;
const BLOAT_ACS = 20;

function lines(content) {
  const out = content.split('\n');
  if (out.length && out[out.length - 1] === '') out.pop();
  return out;
}

/** First value of `field` inside the leading frontmatter block only. */
function frontmatterField(fileLines, field) {
  let fence = 0;
  for (const line of fileLines) {
    if (line === '---') { fence += 1; continue; }
    if (fence !== 1) continue;
    if (line.startsWith(`${field}:`)) return line.slice(field.length + 1).replace(/^[ \t]*/, '');
  }
  return '';
}

/**
 * Walk each AC section and report what it is missing. A section ends at the next
 * AC heading or any H2, so a criterion cannot borrow the next one's evidence.
 */
function checkCriteria(fileLines) {
  const failures = [];
  let current = '';
  let seen = {};
  const flush = () => {
    if (!current) return;
    if (!seen.verification) failures.push(`FAIL: ${current} missing Verification: line`);
    if (!seen.rubric) failures.push(`FAIL: ${current} missing Rubric tie-in: line`);
    if (!(seen.given && seen.when && seen.then)) failures.push(`FAIL: ${current} missing Given/When/Then triplet`);
  };
  for (const line of fileLines) {
    if (AC_HEADING.test(line)) { flush(); current = line; seen = {}; continue; }
    if (current) {
      if (/^\*\*Given\*\*/.test(line)) seen.given = true;
      if (/^\*\*When\*\*/.test(line)) seen.when = true;
      if (/^\*\*Then\*\*/.test(line)) seen.then = true;
      if (line.includes('Verification:')) seen.verification = true;
      if (line.includes('Rubric tie-in:')) seen.rubric = true;
    }
    if (line.startsWith('## ')) { flush(); current = ''; seen = {}; }
  }
  flush();
  return failures;
}

function validateContract(contract, { usage = null } = {}) {
  if (!contract) {
    return { exit: 2, stdout: [], stderr: [`usage: ${usage || 'validate-contract'} <path-to-contract.md>`] };
  }
  let content;
  try {
    if (!fs.statSync(contract).isFile()) throw new Error('not a file');
    content = fs.readFileSync(contract, 'utf8');
  } catch {
    return { exit: 1, stdout: [], stderr: [`FAIL: contract file not found: ${contract}`] };
  }

  const fileLines = lines(content);
  const stderr = [];

  for (const field of REQUIRED_FIELDS) {
    if (!frontmatterField(fileLines, field)) stderr.push(`FAIL: missing required frontmatter field: ${field}`);
  }

  // An absent value was already reported above; do not report it twice as invalid.
  const status = frontmatterField(fileLines, 'status');
  if (status && !VALID_STATUS.includes(status)) {
    stderr.push(`FAIL: status '${status}' not in {draft, negotiating, signed, amended, closed}`);
  }
  const preset = frontmatterField(fileLines, 'rubric_preset');
  if (preset && !VALID_PRESETS.includes(preset)) {
    stderr.push(`FAIL: rubric_preset '${preset}' not in canonical preset list`);
  }

  const acCount = fileLines.filter((l) => AC_HEADING.test(l)).length;
  if (acCount < MIN_ACS) stderr.push(`FAIL: only ${acCount} AC entries (minimum ${MIN_ACS})`);
  if (acCount > BLOAT_ACS) stderr.push(`WARN: ${acCount} AC entries — contract bloat risk (target 5–15)`);

  stderr.push(...checkCriteria(fileLines));

  if (INJECTION.test(content)) stderr.push('FAIL: instruction-like injection pattern detected in contract text');

  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) stderr.push(`FAIL: missing required section: ${section}`);
  }

  // A bloat WARN is advisory: it is reported but does not fail the contract.
  if (!stderr.some((l) => l.startsWith('FAIL:'))) {
    return {
      exit: 0,
      stdout: [`CONTRACT_VALID: ${contract} (${acCount} ACs, status=${status}, preset=${preset})`],
      stderr,
    };
  }
  return { exit: 1, stdout: [], stderr: [...stderr, '', `VALIDATION_FAILED: ${contract}`] };
}

const result = validateContract(process.argv[2] || '', { usage: process.argv[1] });
if (result.stdout.length) process.stdout.write(`${result.stdout.join('\n')}\n`);
if (result.stderr.length) process.stderr.write(`${result.stderr.join('\n')}\n`);
process.exit(result.exit);
