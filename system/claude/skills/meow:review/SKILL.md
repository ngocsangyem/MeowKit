---
name: meow:review
preamble-tier: 4
version: 1.1.0
description: |
  Multi-pass code review with adversarial analysis. Supports input modes: branch diff (default),
  PR number (#123), commit hash, pending changes (--pending). Use when asked to "review this PR",
  "code review", "pre-landing review", "check my diff", or "review #123".
  Proactively suggest when the user is about to merge or land code changes.
# Adopted from ck:code-review: input mode flexibility
argument-hint: "[#PR | COMMIT | --pending]"
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - WebSearch
source: gstack
---

# Pre-Landing Code Review

Multi-pass code review with adversarial analysis, spec compliance, and auto-fix. Covers scope drift, code quality, design, test coverage, adversarial red-teaming, and fix-first resolution.

## Workflow Integration

Operates in **Phase 4 (Review)** of MeowKit's workflow. Invoked by the `reviewer` agent. BLOCK verdict prevents Phase 5 (Ship).

## Input Modes

| Input                    | Mode            | What Gets Reviewed                                             |
| ------------------------ | --------------- | -------------------------------------------------------------- |
| _(default — no args)_    | **Branch diff** | Current branch diff against base branch                        |
| `--pending`              | **Pending**     | Staged + unstaged changes via `git diff` + `git diff --cached` |
| `#123` or PR URL         | **PR**          | Full PR diff via `gh pr diff 123`                              |
| `abc1234` (7+ hex chars) | **Commit**      | Single commit diff via `git show abc1234`                      |

**Default:** If invoked with no arguments, review the current branch diff (existing behavior).

## When to Use

- User asks to "review this PR", "code review", "pre-landing review", or "check my diff"
- User is about to merge or land code changes (proactive suggestion)
- Before running `/meow:ship` to ensure quality gate passes
- **For complex changes (3+ files):** Run `/meow:scout` first to identify edge cases before review

## Workflow

1. **Preamble** — Run session setup, telemetry init, upgrade check, lake intro, contributor mode. See [references/preamble.md](references/preamble.md).

2. **Step 0: Detect base branch** — Check for existing PR base (`gh pr view`), fall back to default branch (`gh repo view`), then fall back to `main`. Use this base for all subsequent git commands.

3. **Step 1: Check branch** — Verify we are not on the base branch and that a diff exists against `origin/<base>`. If no diff, stop with a message.

4. **Step 1.5: Scope drift detection** — Compare the diff against plan file, TODOS.md, and PR description to detect scope creep or missing requirements. See [references/scope-drift-detection.md](references/scope-drift-detection.md).

5. **Step 2: Read the checklist** — Read `.claude/skills/meow:review/checklist.md`. Stop if unreadable.

6. **Step 2.5: External PR comments** — If PR has GitHub reviewer or CI bot comments, fetch and classify them for resolution in Step 5.

7. **Step 3: Get the diff** — `git fetch origin <base> --quiet` then `git diff origin/<base>` for the full diff.

8. **Step 4: Two-pass review** — Apply checklist in two passes (critical then informational). See [references/two-pass-review.md](references/two-pass-review.md).

9. **Step 4.5: Design review** — Conditional on frontend files in diff. See [references/design-review.md](references/design-review.md).

10. **Step 4.75: Test coverage diagram** — Trace codepaths, map user flows, identify gaps, generate tests. See [references/test-coverage.md](references/test-coverage.md).

11. **Step 5: Fix-first review** — Classify findings as AUTO-FIX or ASK, apply fixes, batch-ask user on remaining items. See [references/fix-first-review.md](references/fix-first-review.md).

12. **Step 5.5-5.6: Post-review checks** — TODOS cross-reference and documentation staleness check. See [references/post-review-steps.md](references/post-review-steps.md).

13. **Step 5.7: Adversarial review** — Auto-scaled by diff size (small/medium/large). Uses Codex and/or Claude subagent. See [references/adversarial-review.md](references/adversarial-review.md).

14. **Step 5.8: Persist result** — Log final review outcome for `/meow:ship` to consume. See [references/post-review-steps.md](references/post-review-steps.md).

15. **Telemetry** — Log skill duration and outcome. See [references/preamble.md](references/preamble.md).

## References

| File                                                                       | Contents                                                                                                                                                                                      |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [references/preamble.md](references/preamble.md)                           | Session setup, upgrade check, telemetry, AskUserQuestion format, completeness principle, repo ownership mode, search-before-building, contributor mode, completion status, plan status footer |
| [references/scope-drift-detection.md](references/scope-drift-detection.md) | Plan file discovery, actionable item extraction, cross-reference against diff, scope creep and missing requirements detection                                                                 |
| [references/two-pass-review.md](references/two-pass-review.md)             | Two-pass checklist application (critical then informational), enum completeness, search-before-recommending                                                                                   |
| [references/design-review.md](references/design-review.md)                 | Frontend-conditional design review, design checklist application, Codex design voice                                                                                                          |
| [references/test-coverage.md](references/test-coverage.md)                 | Test framework detection, codepath tracing, user flow mapping, coverage diagram, E2E/eval decision matrix, regression rule, gap test generation                                               |
| [references/fix-first-review.md](references/fix-first-review.md)           | Finding classification (AUTO-FIX vs ASK), batch user questions, verification of claims, external PR comment resolution                                                                        |
| [references/adversarial-review.md](references/adversarial-review.md)       | Auto-scaled adversarial review (small/medium/large tiers), Codex and Claude subagent passes, cross-model synthesis                                                                            |
| [references/post-review-steps.md](references/post-review-steps.md)         | TODOS cross-reference, documentation staleness check, persist eng review result, important rules                                                                                              |
| [checklist.md](checklist.md)                                               | Review checklist (read in Step 2)                                                                                                                                                             |
| [design-checklist.md](design-checklist.md)                                 | Design review checklist (read in Step 4.5)                                                                                                                                                    |
| —                                                                          | _(Greptile integration removed — MeowKit uses its own reviewer agent)_                                                                                                                        |
| [security-checklist.md](security-checklist.md)                             | Security review checklist                                                                                                                                                                     |
| [structural-audit.md](structural-audit.md)                                 | Structural audit reference                                                                                                                                                                    |

## Verdict Output

After all passes complete, output this summary:

```
## Review Verdict: {SEARCH_TARGET}

**Mode:** {branch diff | pending | PR #N | commit HASH}
**Diff:** +{ins}/-{del} lines across {N} files
**Spec:** {found at path | not found — scope drift check only}

### Critical Findings ({N})
{numbered list — must be resolved before merge}

### Informational ({N})
{numbered list — non-blocking}

### Adversarial ({tier}: {small|medium|large})
{findings from adversarial review or "skipped (small diff)"}

### Verdict
{APPROVE — no blocking issues}
{REQUEST CHANGES — N critical findings must be resolved}
{BLOCK — critical security or spec violation, requires human resolution}

### Required Actions
{numbered list if REQUEST CHANGES or BLOCK — empty if APPROVE}
```

**Verdict rules:**

- **APPROVE** — zero critical findings across all passes
- **REQUEST CHANGES** — 1+ critical findings that can be fixed
- **BLOCK** — security vulnerability, spec violation, or 3+ unresolved critical findings

BLOCK verdict prevents `/meow:ship` from executing (Gate 2 enforcement).

## Gotchas

- **Reviewing diff without full context**: Approving a change that breaks an unstated invariant → Always read the surrounding file, not just the diff hunks
- **Style nits hiding real bugs**: 10 comments about formatting, zero about the missing null check → Prioritize: security > correctness > performance > style
