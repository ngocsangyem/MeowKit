'use strict';
// hook-corpus-content.cjs — the artifact bodies the BASE gates read: plans,
// sprint contracts, review verdicts and the active-plan pointer.
//
// These are deliberately minimal but REAL: each one satisfies (or deliberately
// fails) the actual parser in the BASE script, so a fixture records a genuine
// decision rather than a shape the recorder invented.

/** A plan file with YAML frontmatter, ready to be stamped or left bare. */
function planBody(slug) {
  return [
    '---',
    `task: ${slug}`,
    'status: active',
    '---',
    '',
    `# Plan — ${slug}`,
    '',
    '## Problem',
    'A deterministic plan body for the golden corpus.',
    '',
    '## Success Criteria',
    '- The corpus records what BASE does.',
    '',
    '## Technical Approach',
    'Record, do not interpret.',
    '',
  ].join('\n');
}

/**
 * A sprint contract. With the defaults it satisfies validate-contract.sh: the 8
 * required frontmatter fields, the 5 required sections, >= 5 ACs, and a
 * Given/When/Then triplet plus a Verification and a Rubric tie-in line per AC.
 */
function contractBody({ slug, sprint = 1, status = 'signed', acCount = 5, signed = true }) {
  const head = [
    '---',
    'contract_schema_version: 1.0.0',
    `task: ${slug}`,
    `sprint: ${sprint}`,
    `plan_ref: tasks/plans/261101-${slug}/plan.md`,
    'rubric_preset: cli-tool',
    `status: ${status}`,
    `generator_signed: ${signed ? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' : 'null'}`,
    `evaluator_signed: ${signed ? 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' : 'null'}`,
    'rounds: 1',
    'created: 261101-0000',
    '---',
    '',
    `# Sprint ${sprint} Contract — ${slug}`,
    '',
    '## Scope (In)',
    '',
    '- The deterministic behavior the corpus records',
    '',
    '## Scope (Out)',
    '',
    '- Anything the corpus does not record',
    '',
    '## Acceptance Criteria',
    '',
  ];
  const acs = [];
  for (let i = 1; i <= acCount; i += 1) {
    const n = String(i).padStart(2, '0');
    acs.push(
      `### [AC-${n}] Criterion ${n}`,
      '',
      `**Given** input ${n}`,
      `**When** the command runs with input ${n}`,
      `**Then** it exits 0 and prints marker-${n}`,
      '',
      `- **Verification:** run the command with input ${n} and read the exit code`,
      '- **Rubric tie-in:** functionality (weight 0.40)',
      '',
    );
  }
  const tail = [
    '## Rubric Bindings',
    '',
    '- functionality: every AC above',
    '',
    '## Negotiation Log',
    '',
    '- Round 1 (proposer/generator): initial draft',
    '- Round 1 (reviewer/evaluator): accepted',
    '',
  ];
  return head.concat(acs, tail).join('\n');
}

/**
 * A review or security verdict. `revision` binds it to a commit — omit it to
 * record gate2-check's revision-binding block.
 */
function verdictBody({ slug, revision = null, fail = false, kind = 'review' }) {
  const lines = [
    `# ${kind === 'security' ? 'Security ' : ''}Verdict — ${slug}`,
    '',
    'Score: 9/10',
    '',
    '| Dimension | Status |',
    '|-----------|--------|',
    `| Functionality | ${fail ? 'FAIL' : 'PASS'} |`,
    '| Security | PASS |',
    '| Code quality | PASS |',
    '| Tests | PASS |',
    '| Docs | WARN |',
    '',
    'Critical (0)',
    '',
  ];
  if (revision) lines.push(`Revision: ${revision}`, '');
  return lines.join('\n');
}

/** The explicit active-plan pointer gate2-check and pre-completion-check read. */
function activePlanPointer(planDir) {
  return `${JSON.stringify({ path: planDir }, null, 2)}\n`;
}

module.exports = { activePlanPointer, contractBody, planBody, verdictBody };
