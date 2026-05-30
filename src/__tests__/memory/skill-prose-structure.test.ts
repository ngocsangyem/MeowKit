// skill-prose-structure.test.ts — Phase 2 guard. Skill/agent/command prose that
// reads curated memory is LLM-executed, not unit-testable behaviorally; this is the
// automatable half: grep-assert each reader file carries the JSON-first phrasing and
// references the canonical rule. (Actual conflict-warning behavior is a documented
// manual acceptance check, out of CI scope.)
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf-8');

const RULE_FILE = '.claude/rules/memory-read-rules.md';

// Readers that must prefer JSON and reference the source-of-truth rule.
const JSON_FIRST_READERS = [
  '.claude/skills/review/SKILL.md',
  '.claude/skills/cso/SKILL.md',
  '.claude/skills/fix/SKILL.md',
  '.claude/skills/plan-creator/step-00-scope-challenge.md',
  '.claude/agents/orchestrator.md',
  '.claude/agents/researcher.md',
  '.claude/agents/planner.md',
  '.claude/commands/mk/retro.md',
  '.claude/commands/mk/meow.md',
  'CLAUDE.md',
];

describe('JSON-first reader prose (Phase 2)', () => {
  it('the canonical memory-read rule file exists and states JSON-first precedence', () => {
    expect(existsSync(resolve(root, RULE_FILE))).toBe(true);
    const rule = read(RULE_FILE);
    expect(rule).toMatch(/JSON.first/i);
    expect(rule).toMatch(/canonical/i);
    expect(rule).toMatch(/fall back/i);
  });

  it.each(JSON_FIRST_READERS)('%s reads JSON-first and points at the rule (or carries the precedence inline)', (file) => {
    const content = read(file);
    // Must name a canonical .json store as the primary read.
    expect(content).toMatch(/\.json/);
    // Must either reference the rule file or restate JSON-first + MD fallback inline.
    const referencesRule = content.includes('memory-read-rules.md');
    const inlinePrecedence = /json.first/i.test(content) || (/\.json/.test(content) && /fall ?back/i.test(content));
    expect(referencesRule || inlinePrecedence).toBe(true);
  });

  it('no reader instructs reading the legacy .md trio as the PRIMARY source', () => {
    for (const file of JSON_FIRST_READERS) {
      const content = read(file);
      // A bare "Read fixes.md first" with no JSON mention would be a regression.
      // We already assert .json presence above; here ensure md mentions are fallback-framed.
      const mdPrimary = /read[^.\n]*\bfixes\.md\b(?![^\n]*json)/i.test(content) && !/fall ?back/i.test(content);
      expect(mdPrimary, `${file} appears to read .md as primary`).toBe(false);
    }
  });
});
