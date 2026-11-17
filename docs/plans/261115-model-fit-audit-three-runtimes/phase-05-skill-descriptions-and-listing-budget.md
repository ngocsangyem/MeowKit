---
phase: 5
title: "Skill descriptions and listing budget"
status: done
priority: P1
effort: "2.5d"
dependencies: [1]
---

# Phase 5: Skill descriptions and listing budget

## Context Links

- [Baseline and vendor sources](research/baseline-and-vendor-sources.md) — §1 description row, N3, N4, N5; §3 rows Anthropic skills, Codex skills, Cursor skills
- `.claude/skills/*/SKILL.md` frontmatter (`description`, `when_to_use`), bundle `SKILL.md` frontmatter
- `docs/research/meowkit-evolution-2611/05-skill-agent-rule-hook-audit.md` §6(d) and C-17
- `mewkit doctor` skill-listing row (prior plan Phase 5)

## Overview

- **Priority:** P1
- **Status:** Done (worktree, branch `integration/model-fit-audit`)
- **Effort:** 2.5d
- **Depends on:** Phase 1
- **Description:** Make each skill's listing text a tight trigger that survives truncation on every host, and bring each tree's listing under a stated budget. One pull request across three trees; no skill is hidden or deleted without the user's OK.

## Key Insights

- Listing size is about equal on three trees: Claude Code `description`+`when_to_use` 22,368 chars, Codex 22,482, Cursor 22,272 (from: research/baseline-and-vendor-sources.md §1). The brief's 13.9k figure left out `when_to_use`.
- Budgets: Claude Code 1% of context with a 1,536-char cap per skill (snapshot #18, #65); Codex 2% of context or 8,000 chars when unknown, shortening descriptions first, then dropping skills (§3 Codex skills). At 8,000 chars the Codex listing loses about 64% of its text today.
- Codex advice: front-load the use case and trigger words so a shortened description still matches (§3).
- Bundle descriptions name skills as `mk:investigate`, which is not a name on Codex or Cursor (N3).
- Cursor already hides 12 skills from model invocation, Codex 1, Claude Code 0 (N5); Codex has `agents/openai.yaml` `policy.allow_implicit_invocation: false` for the same effect, unused.
- Install profiles (`core`, `developer`, …) already drop the 23 Atlassian entries for users who choose them (audit §6(d)).

## Requirements

### Functional
1. Every description: third person, what it does then when to use it, trigger words in the first 100 characters, one `NOT for` line kept where it disambiguates (A11).
2. Bundle descriptions use host names (`mk-x`) (A10).
3. Claude Code: `when_to_use` merged into a shorter whole or kept, so that the pair is ≤ 1,536 chars and the tree total drops.
4. Per-tree listing target written into the criteria doc and met: Claude Code and Cursor ≤ 16,000 chars; Codex ≤ 12,000 chars (so a 128k-window session keeps whole descriptions) — targets are proposals for the user to confirm.
5. Hidden-from-model alignment across hosts is presented as a choice (keep each host as is, or align the 12 Cursor choices to Codex `allow_implicit_invocation: false` and Claude Code `disable-model-invocation`); applied only on OK.
6. An offline routing fixture (30 labelled prompts → expected skill) checks that each expected skill's description contains the prompt's trigger words; no model call.

### Non-Functional
- Skill names unchanged; `NOT for` disambiguation on 125/128 skills kept.

## Architecture

```
description rewrite (.claude) → port with host names → checker A10/A11 + listing totals
routing fixture (prompt, expected skill, trigger words) → keyword test, no model run
```

## Related Code Files

### Files to Create
- `tests/fixtures/skill-routing-prompts.json`, `tests/skill-routing-keywords.test.ts`

### Files to Modify
- `.claude/skills/*/SKILL.md` frontmatter (127), `kit/bundles/codex/root/.agents/skills/*/SKILL.md` (124), `kit/bundles/cursor/root/.cursor/skills/*/SKILL.md` (123)
- `.claude/skills/SKILLS_INDEX.md` and bundle catalogs if they copy descriptions
- `docs/maintainer/instruction-audit-criteria.md` — listing targets

### Files to Read (Context)
- `crates/mewkit-cli/src/commands/doctor/` skill-listing row — keep its threshold consistent with the targets

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Modify | `.claude/skills/*/SKILL.md` frontmatter | trigger-first text | skill contract tests that pin descriptions |
| Modify | bundle `SKILL.md` frontmatter | port, host names | `validate --target codex` |
| Create | routing fixture and test | catch trigger loss | new |
| Modify | catalogs/index copies | stay equal | `stale_index` validator |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Description still triggers on its prompts | none | keyword fixture | High |
| Index copies equal frontmatter | `stale_index` | none | — |

### Interface Checklist

- `name` values; `argument-hint`; `user-invocable` flags.

### Dependency Map

- Phase 6 body edits come after, so descriptions and bodies agree.

## Implementation Steps

1. Confirm listing targets and the hidden-skill choice with the user.
2. Write the routing fixture from real prompt phrasings per skill cluster.
3. Rewrite Claude Code descriptions cluster by cluster; check A11 and the fixture.
4. Port to Codex and Cursor with host names; regenerate or hand-edit catalogs and index.
5. Run checker, routing test, `mewkit validate`, skill contract tests; record listing totals.

## Todo List

- [x] Targets and hidden-skill choice confirmed
- [x] Routing fixture written
- [x] Claude Code descriptions rewritten
- [x] Bundles ported with host names; catalogs equal
- [x] Checks green; totals recorded

## Success Criteria

1. `node scripts/check-instruction-criteria.cjs --metrics` shows each tree's listing total at or under its confirmed target.
2. `npx vitest run tests/skill-routing-keywords.test.ts` exits 0.
3. Checker A10 and A11 report 0 findings on three trees.
4. `mewkit validate` and `bash tests/skill-contract-coverage.test.sh` exit 0.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Shorter text loses a real trigger | M | H | Routing fixture; `NOT for` kept |
| Keyword fixture passes while live routing fails | M | M | Optional live routing eval (audit C-17) offered, ask first |
| Contract tests pin old descriptions | H | L | Update pins in the same PR |

## Security Considerations

- N/A (frontmatter text only).

## Outcome (2026-11-16)

- Decisions (user, 2026-11-16): ceilings Claude Code 16,000 / Codex 12,000 / Cursor 16,000 chars; hidden-from-model kept as each host has it (Cursor 12, others 0).
- Listing chars: Claude Code 22,368 → 14,150; Codex 22,482 → 9,784; Cursor 22,272 → 9,653. The checker now fails a tree over its ceiling (`listing`, never baselined).
- 373 SKILL.md frontmatters rewritten: trigger words first, third person, one NOT-for where it disambiguates; bundle text uses `mk-x` names and one folded "use when" clause.
- Routing fixture: 30 prompts, `tests/skill-routing-keywords.test.ts` checks trigger words on three trees (87 tests).
- Contract pins moved with the text: build-fix, document-release, fix.
- Found, not fixed: `tests/workflow-orchestrator-skill-contract.test.sh` fails on `main` already; it pins Gate 1/Gate 2 wording removed with the gates.
- Live routing eval (audit C-17) not run.

## Next Steps

- Phase 6 aligns bodies; audit C-17 live eval stays a follow-up unless approved.
