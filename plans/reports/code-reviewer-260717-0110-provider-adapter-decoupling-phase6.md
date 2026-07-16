# Code Review: Provider-Adapter Decoupling Slice (Phase 6)

## Scope
- 9 canonical files (diff reviewed via `git diff`), 8 `plugin/**` mirrors correctly excluded (generated, unedited).
- 15 insertions / 7 deletions across docs + frontmatter + 1 test file. Zero production/logic code touched.
- Governing rule: `.claude/rules/skill-authoring-rules.md` Rule 7.

## Verification Performed
- Read `stitch-quota.ts` and `stitch-api-call.ts` source, cross-checked against both stitch doc rewrites.
- Ran `npx vitest run packages/mewkit/src/core/__tests__/check-generic-core-tokens.test.ts` — 10/10 pass.
- Ran the actual `findGenericCoreTokens` function against a scratchpad copy of the 4 skill dirs with a brand token deliberately reintroduced, to confirm the new guard is non-vacuous (mutation test, not a repo edit — cleaned up after).
- Grepped `adapted_for` across `.claude/skills/*/SKILL.md` and confirmed it's an existing convention (7 skills now, was 5), and grepped for any consumer of the field (none found — documentary only).
- Parsed frontmatter YAML for both `adapted_for` additions with `yaml.safe_load` — valid.

## Findings

### Critical
None.

### High
None.

### Medium
None.

### Low
1. `.claude/skills/stitch/references/quota-management.md:18` — the rewrite "falls back to a `stitch/` folder under the home-directory plugin-data path" is accurate but requires the reader to already know `CLAUDE_PLUGIN_DATA` semantics to reconstruct the literal path (`~/.meowkit/stitch/`). Not a defect — Rule 7 explicitly requires dropping the brand literal from narrative prose — but it's a readability tradeoff worth noting if this doc gets more portability passes later. No action needed.

### Positive / Confirmed Correct
1. **Stitch docs accuracy (item 1 in task)** — `stitch-quota.ts:24-26` (`PLUGIN_DATA = process.env.CLAUDE_PLUGIN_DATA ?? path.join(os.homedir(), ".meowkit")`, `QUOTA_DIR = path.join(PLUGIN_DATA, "stitch")`) matches the rewritten doc line exactly (same fallback semantics, no brand literal). `stitch-api-call.ts:109` (`const name = detected || "meowkit-default"`) matches `stitch-sdk-api.md:128`'s "Hardcoded default project-name fallback (see `scripts/stitch-api-call.ts`)" — truthful, points the reader at the actual code instead of hardcoding the literal in prose. No code changed in either script; only docs stripped the literal.
2. **Meaning preservation (item 2)** — `advise/SKILL.md:115-116` ("Ask the user to choose ... use plain prose when open-ended") preserves the structured-vs-open-ended distinction intact. `visual-plan/SKILL.md:55` ("ask the user for it") is arguably *more* accurate than the original — the missing-plan-dir case is open-ended free-text input (a path), not a bounded-choice prompt, so replacing "AskUserQuestion" (a structured-choice tool) with generic "ask" removes a mechanism mismatch rather than losing information.
3. **`adapted_for: claude-code` convention (item 3)** — confirmed pre-existing on `frontend-design`, `llms`, `skill-creator`, `typescript`, `project-organization` (5 skills) before this diff; `agent-detector` and `trace-analyze` bring it to 7. No new convention introduced. `.claude/scripts/check-anthropic-context.py:95` explicitly exempts `adapted_for` from narrative-prose rules (documentary/metadata field), consistent with how it's used here. Grepped for consumers — none found; field is advisory only, matching the pattern of other advisory frontmatter fields in `skill-authoring-rules.md`.
4. **Test non-vacuousness (item 4)** — `findGenericCoreTokens(join(process.cwd(), ".claude"), "skills/<name>")` resolves to real directories under `vitest run` (repo root cwd), confirmed by the pre-existing sibling test `"keeps scale-routing provider-neutral"` using the identical pattern. Mutation test (see Verification) proves the new assertion fails when a brand token is reintroduced into any of the 4 target skill trees — not vacuous.
5. **Regression scope (item 5)** — diff is 9 files: 6 doc/prose edits, 2 frontmatter-only additions (single scalar key each), 1 test addition. No public contract, schema, or runtime logic touched. `plugin/**` mirrors are generated (`mewkit build-plugin`) and out of scope per task instructions — spot-checked they track the canonical diff 1:1.

## Unresolved Questions
None — all 5 verification items resolved with direct evidence.

**Status:** DONE
**Summary:** All 5 verification items pass with direct evidence (source cross-check, mutation test, YAML parse, grep for conventions/consumers). Zero critical/high/medium findings; diff is docs + advisory frontmatter + test-only as claimed, stitch doc rewrites remain truthful against unchanged source, and the new guard is proven non-vacuous via mutation test.
**Concerns/Blockers:** None.
