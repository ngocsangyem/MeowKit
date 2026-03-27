---
title: "Fix: [BUG SUMMARY]"
type: bug-fix
status: draft
phase: 1
priority: high
effort: small
created: YYYY-MM-DD
branch: fix/kebab-bug-description
agent: ""
---

# Fix: [BUG SUMMARY]

<!-- Agent fills: Complete all sections before Gate 1. No code until approved. -->

## Goal

<!-- One sentence. What broken behavior will be correct after this fix? -->
[After this fix, SYSTEM correctly does X when Y happens, instead of BROKEN BEHAVIOR.]

## Bug Report

- **Reported by:** [user / monitoring / agent]
- **Reproducible:** yes / no / intermittent
- **Environment:** [production / staging / local / all]
- **Frequency:** [always / sometimes — N% of requests / rare]
- **First seen:** [date or version]
- **Error message / stack trace:**

```
[Paste exact error here]
```

## Root Cause Analysis

<!-- Agent fills after investigation. Do not skip this section. -->
- **Hypothesis:** [initial theory of what's wrong]
- **Confirmed cause:** [what the investigation found — specific file:line if possible]
- **Why not caught earlier:** [missing test / edge case / timing / environment difference]

## Scope

**In scope:**
- Fix the specific broken behavior described above
- Add regression test to prevent recurrence

**Out of scope:**
- Refactoring surrounding code
- Fixing related-but-separate issues (add those to backlog)

## Constraints

- MUST NOT change behavior for any other code path
- MUST add a failing test that reproduces the bug BEFORE fixing it
- MUST pass all existing tests after fix

## Fix Approach

<!-- Agent fills: Numbered steps. Keep minimal — fix only what's broken. -->
1. Write a failing test that reproduces the exact bug
2. [Specific change to make — file and what to change]
3. Verify fix makes the test pass
4. Run full test suite to confirm no regressions

## Regression Risk

<!-- What could this fix break? List areas to re-test. -->
- [Area 1 that could be affected]
- [Area 2 that could be affected]

## Acceptance Criteria

- [ ] Failing reproduction test exists and was confirmed failing before fix
- [ ] The reported error no longer occurs in [environment]
- [ ] Reproduction test passes after fix
- [ ] All existing tests pass (no regressions)
- [ ] TypeScript compiles with zero errors

## Related

- Affected files: `src/[file]:[line]`
- Test file: `tests/[file]`
- Issue / ticket: [link or ID]

## Agent State

<!-- Agent fills after every significant action. Keep current. -->
Current phase: 1 — Planning
Last action: Task file created
Next action: Reproduce bug locally, confirm root cause, get Gate 1 approval
Blockers: none
Decisions made: none yet
