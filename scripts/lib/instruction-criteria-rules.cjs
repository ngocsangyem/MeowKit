'use strict';
// instruction-criteria-rules.cjs — the mechanical half of the instruction audit criteria
// (docs/maintainer/instruction-audit-criteria.md). Each check takes one file's text and
// returns findings; the CLI in scripts/check-instruction-criteria.cjs walks the trees.
//
// Only what a pattern can decide lives here. Criteria that need judgement (A3 emphasis,
// A4 duplication, A6 host names, A7 agent tools) are reviewed by hand against the
// criteria document; the emphatic-token count is reported as a metric, not a failure.

const fs = require('node:fs');
const path = require('node:path');

/** A1: an instruction to obtain or wait for an approval gate. */
const GATE_PHRASES = [
  /\bgate[ -]?[12]\b/i,
  /\bgate-rules\.md\b/,
  /\bapproval receipt\b/i,
  /\bHARD GATE\b/,
];

/** A5: verbs and files that no longer exist. A mention is a stale instruction. */
const REMOVED_VERBS = [/\bplan approve\b/, /\bvalidate --gates\b/, /\bverdict-gate\b/];
const REMOVED_FILES = [
  'gate-enforcement.cjs', 'pre-implement.cjs', 'plan-gate.cjs', 'gate1-hatch', 'gate1-path-rules',
  'approval-receipt', 'check-contract-signed', 'validate-contract', 'plan-discovery',
  'gate2-check', 'gate2-change-set', 'gate2-structural-checks', 'gate2-verdict-lookup',
  'validate-gate-2', 'validate-workflow-evidence', 'validate-review-coverage',
  'MEOWKIT_GATE1_PRESENCE_ONLY',
];

/** A2: an enforcement claim. Allowed only when the mechanism it names exists. */
const ENFORCED_BY = /enforced by `([^`]+)`/g;
const UNNAMED_ENFORCEMENT = [/\bno bypass\b/i, /\bhook-enforced\b/i];

/** Emphatic absolutes, reported per tree so the before and after tables can compare them. */
const EMPHATIC = /\b(MUST|NEVER|ALWAYS|IMPORTANT|CRITICAL|NON-NEGOTIABLE|MANDATORY)\b/g;

/**
 * Text that must not change: the blocked-pattern table and the numbered injection rules.
 * They mention gates in their own terms ("bypass gates"), so they are exempt from A1 and
 * pinned by hash instead.
 */
const PINNED_SECTIONS = [
  { file: 'rules/security-rules.md', from: '## Blocked Patterns', to: '## Enforcement' },
  { file: 'rules/injection-rules.md', from: '## Rule 1:', to: '## Enforcement' },
];

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function matchAll(text, patterns, criterion, label) {
  const out = [];
  for (const re of patterns) {
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    for (const m of text.matchAll(global)) out.push({ criterion, line: lineOf(text, m.index), text: `${label}: ${m[0]}` });
  }
  return out;
}

/** Strip the pinned sections so their wording does not count against A1. */
function withoutPinned(rel, text) {
  const pin = PINNED_SECTIONS.find((p) => rel.endsWith(p.file));
  if (!pin) return text;
  const start = text.indexOf(pin.from);
  const end = text.indexOf(pin.to, start + 1);
  if (start < 0 || end < 0) return text;
  // Keep the line count so reported line numbers stay right.
  return text.slice(0, start) + text.slice(start, end).replace(/[^\n]/g, ' ') + text.slice(end);
}

function checkFile(rel, text, treeRoot) {
  const body = withoutPinned(rel, text);
  const findings = [
    ...matchAll(body, GATE_PHRASES, 'A1', 'gate instruction'),
    ...matchAll(body, REMOVED_VERBS, 'A5', 'removed verb'),
    ...matchAll(body, REMOVED_FILES.map((f) => new RegExp(f.replace(/[.]/g, '\\.'))), 'A5', 'removed file'),
    ...matchAll(body, UNNAMED_ENFORCEMENT, 'A2', 'enforcement claim with no mechanism'),
  ];
  for (const m of body.matchAll(ENFORCED_BY)) {
    const target = m[1].split(/\s/)[0];
    const candidates = [path.join(treeRoot, target), path.join(treeRoot, '..', target)];
    if (/[/.]/.test(target) && !candidates.some((c) => fs.existsSync(c))) {
      findings.push({ criterion: 'A2', line: lineOf(body, m.index), text: `enforced by a missing mechanism: ${target}` });
    }
  }
  return findings;
}

function emphaticCount(text) {
  return (text.match(EMPHATIC) || []).length;
}

function gatePhraseCount(rel, text) {
  return matchAll(withoutPinned(rel, text), GATE_PHRASES, 'A1', '').length;
}

function pinnedText(treeRoot) {
  return PINNED_SECTIONS.map((p) => {
    const file = path.join(treeRoot, p.file);
    if (!fs.existsSync(file)) return '';
    const text = fs.readFileSync(file, 'utf8');
    const start = text.indexOf(p.from);
    return start < 0 ? '' : text.slice(start, text.indexOf(p.to, start + 1));
  }).join('\n');
}

module.exports = { checkFile, emphaticCount, gatePhraseCount, pinnedText, PINNED_SECTIONS };
