'use strict';
// instruction-criteria-host-rules.cjs — criteria that depend on which runtime a tree ships to:
// host-foreign tool syntax, the skill-reference name form, agent model pins, and standing
// re-verify or unconditional delegate lines.
//
// `kind` is 'claude' for `.claude`, otherwise the runtime the tree is installed for ('codex', 'cursor', 'grok', 'pi' or 'omp').

const fs = require('node:fs');
const path = require('node:path');
const { frontmatterValue, keyLine, tomlValue } = require('./instruction-criteria-frontmatter.cjs');

const TOKENS = JSON.parse(fs.readFileSync(path.join(__dirname, 'host-foreign-tokens.json'), 'utf8')).tokens;

/** Skill references: bundles invoke `mk-x`; Claude Code names skills `mk:x`. */
// Also catches the slash form (`/mk:x`) and a bracketed placeholder (`mk:[skill]`).
const BUNDLE_COLON_NAME = /(?<![/\w])\/?mk:(?:\[[a-z-]+\]|[a-z][a-z0-9-]*)/g;
const CLAUDE_HYPHEN_INVOCATION = /(?<![\w/.-])[/$]mk-[a-z][a-z0-9-]*/g;
/** A command span holding a sentence ("`the cook skill --auto`") or a sibling path ("`..the x skill/`"). */
const BUNDLE_PROSE_INVOCATION = /`(?:Run: |\.\.)?the [a-z0-9-]+ skill\b/g;

/** Standing re-check wording that makes current models over-verify. */
const REVERIFY = /\b(double-check|re-verify|verify again|re-check your)\b/gi;
/** A delegate instruction; it needs a stated condition on the same line. */
const DELEGATE = /\b(spawn (a|the|an) [a-z-]* ?(sub)?agent|use a subagent|delegate to (the )?[a-z-]+ (sub)?agent)\b/i;
const CONDITION = /\b(when|if|unless|only|after|before|once)\b/i;
/** A line that forbids delegating is not a delegate instruction. */
const NEGATION = /\b(never|don't|do not|must not|should not|no need to)\b/i;

/** Statuses in scripts/lib/model-pins.md that an agent may not pin. */
const BAD_PIN_STATUS = new Set(['retired', 'deprecated', 'not listed']);
const RUNTIME = { claude: 'claude-code', codex: 'codex', cursor: 'cursor', grok: 'grok', pi: 'pi', omp: 'omp' };

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function each(text, re, criterion, label) {
  const out = [];
  for (const m of text.matchAll(re)) out.push({ criterion, line: lineOf(text, m.index), text: `${label}: ${m[0]}` });
  return out;
}

/** A9: Claude-Code tool syntax in a bundle tree. */
function hostForeign(text, kind) {
  if (kind === 'claude') return [];
  const out = [];
  for (const t of TOKENS) {
    if (t.hosts && !t.hosts.includes(kind)) continue;
    const re = new RegExp(t.pattern, t.caseInsensitive ? 'gi' : 'g');
    out.push(...each(text, re, 'A9', t.label));
  }
  return out;
}

/** A10: a skill reference in the other runtime's name form. */
function skillNameForm(text, kind) {
  if (kind === 'claude') return each(text, CLAUDE_HYPHEN_INVOCATION, 'A10', 'bundle-form skill invocation (use mk:x)');
  return [
    ...each(text, BUNDLE_COLON_NAME, 'A10', 'Claude Code skill name (use mk-x)'),
    ...each(text, BUNDLE_PROSE_INVOCATION, 'A10', 'skill name as prose inside a command (use $mk-x or /mk-x)'),
  ];
}

/** The `model` an agent file pins, with its line, or null when the file is not an agent. */
function agentModel(rel, text, kind) {
  const isAgent =
    (kind === 'claude' && /^agents\/[^/]+\.md$/.test(rel)) ||
    (kind === 'codex' && /^\.codex\/agents\/[^/]+\.toml$/.test(rel)) ||
    (kind === 'cursor' && /^\.cursor\/agents\/[^/]+\.md$/.test(rel));
  if (!isAgent) return null;
  const value = rel.endsWith('.toml') ? tomlValue(text, 'model') : frontmatterValue(text, 'model');
  return value ? { id: value.replace(/\[.*\]$/, ''), line: keyLine(text, 'model') } : null;
}

/** A13: the pinned model is listed for this runtime and not retired. */
function modelPin(rel, text, kind, pins) {
  const model = agentModel(rel, text, kind);
  if (!model || !pins) return [];
  const status = pins.get(`${RUNTIME[kind]}:${model.id}`);
  if (status && !BAD_PIN_STATUS.has(status)) return [];
  const why = status ? `pinned model is ${status}` : 'pinned model is not in scripts/lib/model-pins.md';
  return [{ criterion: 'A13', line: model.line, text: `${why}: ${model.id}` }];
}

/** A14: standing re-verify wording, and a delegate line with no condition. */
function standingInstructions(text) {
  const out = each(text, REVERIFY, 'A14', 'standing re-verify');
  text.split('\n').forEach((line, i) => {
    const m = line.match(DELEGATE);
    if (m && !CONDITION.test(line) && !NEGATION.test(line)) out.push({ criterion: 'A14', line: i + 1, text: `delegate with no condition: ${m[0]}` });
  });
  return out;
}

function checkHostFile(rel, text, ctx) {
  return [
    ...hostForeign(text, ctx.kind),
    ...skillNameForm(text, ctx.kind),
    ...modelPin(rel, text, ctx.kind, ctx.pins),
    ...standingInstructions(text),
  ];
}

/**
 * Pins from the model-pins table: `| id | runtime | status | ... |` rows, keyed `runtime:id`.
 * Ids are written in backticks; the header and separator rows are skipped.
 */
function readPins(file) {
  const pins = new Map();
  if (!fs.existsSync(file)) return pins;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    const id = (cells[1] || '').match(/^`([^`]+)`$/);
    if (id) pins.set(`${cells[2]}:${id[1]}`, (cells[3] || '').toLowerCase());
  }
  return pins;
}

module.exports = { checkHostFile, readPins, agentModel };
