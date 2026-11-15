'use strict';
// instruction-criteria-skill-rules.cjs — criteria on skill files: the listing text a host
// shows the model (description fitness) and progressive disclosure (body length, contents
// lists on long references, references one level deep).
// Criteria text: docs/maintainer/instruction-audit-criteria.md.

const { frontmatterValue, keyLine } = require('./instruction-criteria-frontmatter.cjs');

const DESCRIPTION_MAX = 1024;
/** Claude Code lists `description` and `when_to_use` together and cuts the pair at this length. */
const CLAUDE_LISTING_MAX = 1536;
const SKILL_BODY_MAX_LINES = 500;
const REFERENCE_CONTENTS_FROM = 100;

/** A description that opens in first or second person instead of third. */
const PERSONAL_OPENER = /^(I(?=[ ']|$)|We|We're|We'll|Our|You|You're|You'll|Your|Let me)\b/;
/** A contents list: a "Contents" heading, or three anchor links near the top. */
const CONTENTS_HEADING = /^#{1,6}\s*(table of )?contents\b/im;
const ANCHOR_LINK = /^\s*[-*\d.]+\s*\[[^\]]+\]\(#[^)]+\)/gm;
/** A reference that sends the reader on to another reference file. */
const READ_VERB = /\b(read|load|follow)\b/i;
const OTHER_REFERENCE = /(references\/[\w.-]+\.md|\]\((?:\.\/)?[\w.-]+\.md\))/g;

const isSkill = (rel) => /(^|\/)SKILL\.md$/.test(rel);
const isReference = (rel) => /(^|\/)references\/[^/]+\.md$/.test(rel);

/** Characters of listing text this skill costs: description, plus when_to_use on Claude Code. */
function listingChars(text, kind) {
  const desc = frontmatterValue(text, 'description') || '';
  const when = kind === 'claude' ? frontmatterValue(text, 'when_to_use') || '' : '';
  return desc.length + when.length;
}

/** A11: third person, within the per-description and per-listing limits. */
function descriptionFitness(text, kind) {
  const desc = frontmatterValue(text, 'description');
  if (desc === undefined) return [];
  const line = keyLine(text, 'description');
  const out = [];
  if (PERSONAL_OPENER.test(desc)) out.push({ criterion: 'A11', line, text: `description opens in first or second person: ${desc.split(/\s/)[0]}` });
  if (desc.length > DESCRIPTION_MAX) out.push({ criterion: 'A11', line, text: `description is ${desc.length} chars, above ${DESCRIPTION_MAX}` });
  const listed = listingChars(text, kind);
  if (kind === 'claude' && listed > CLAUDE_LISTING_MAX) {
    out.push({ criterion: 'A11', line, text: `description + when_to_use is ${listed} chars, above ${CLAUDE_LISTING_MAX}` });
  }
  return out;
}

/** A12: SKILL.md length, contents list on long references, one level of references. */
function progressiveDisclosure(rel, text) {
  // Line count as `wc -l` gives it: a trailing newline does not start another line.
  const lines = text.replace(/\n$/, '').split('\n');
  const out = [];
  if (isSkill(rel) && lines.length > SKILL_BODY_MAX_LINES) {
    out.push({ criterion: 'A12', line: 1, text: `SKILL.md is ${lines.length} lines, above ${SKILL_BODY_MAX_LINES}` });
  }
  if (!isReference(rel)) return out;
  const top = lines.slice(0, 40).join('\n');
  const hasContents = CONTENTS_HEADING.test(top) || (top.match(ANCHOR_LINK) || []).length >= 3;
  if (lines.length > REFERENCE_CONTENTS_FROM && !hasContents) {
    out.push({ criterion: 'A12', line: 1, text: `reference is ${lines.length} lines with no contents list` });
  }
  const self = rel.split('/').pop();
  lines.forEach((l, i) => {
    if (!READ_VERB.test(l)) return;
    for (const m of l.matchAll(OTHER_REFERENCE)) {
      const target = m[0].replace(/^\]\((\.\/)?/, '').replace(/\)$/, '');
      if (target.split('/').pop() === self) continue;
      out.push({ criterion: 'A12', line: i + 1, text: `reference sends the reader to another file: ${target}` });
    }
  });
  return out;
}

function checkSkillFile(rel, text, ctx) {
  return [...(isSkill(rel) ? descriptionFitness(text, ctx.kind) : []), ...progressiveDisclosure(rel, text)];
}

module.exports = { checkSkillFile, listingChars, isSkill };
