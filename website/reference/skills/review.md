---
title: "mk:review"
description: "Multi-pass code review with scope drift detection, adversarial red-teaming, test coverage audit, and fix-first resolution."
---

# mk:review

Multi-pass code review with scope drift detection, adversarial red-teaming, test coverage audit, and fix-first resolution.

## What This Skill Does

`mk:review` runs a comprehensive 15-step code review that goes far beyond "looks good." It detects scope drift against your plan, applies a two-pass checklist (critical → informational), audits test coverage, runs a design review on frontend files, performs adversarial red-teaming scaled by diff size, and auto-fixes trivial issues before asking about non-trivial ones. The final verdict (APPROVE / REQUEST CHANGES / BLOCK) gates whether `mk:ship` can execute.

## Core Capabilities

- **Multiple input modes** — Branch diff (default), PR number (`#42`), commit hash, or pending changes (`--pending`)
- **Scope drift detection** — Compares diff against plan file, TODOS.md, and PR description to catch creep and missing requirements
- **Two-pass checklist** — Pass 1 checks critical issues (SQL injection, race conditions, auth bypass), Pass 2 checks informational (dead code, style)
- **Test coverage audit** — Traces code paths, generates coverage diagram, writes tests for gaps
- **Adversarial review** — Auto-scaled: <50 lines skipped, 50-199 lines cross-model challenge, 200+ lines full battery
- **Fix-first resolution** — Classifies findings as AUTO-FIX or ASK; fixes trivial issues, batch-asks about the rest
- **Verdict gating** — BLOCK verdict prevents `mk:ship` from executing

## When to Use This

::: tip Use mk:review when...
- You're about to merge or ship code
- You want a thorough review before creating a PR
- You need to review someone else's PR
- You want to check uncommitted changes before committing
:::

## Usage

```bash
# Review current branch diff (default)
/mk:review

# Review a specific PR
/mk:review #42

# Review uncommitted changes
/mk:review --pending

# Review a specific commit
/mk:review abc1234
```

## Example Prompts

| Prompt | Input mode | What gets reviewed |
|--------|-----------|-------------------|
| `/mk:review` | Branch diff | Current branch vs base branch |
| `/mk:review #42` | PR | Full PR diff via `gh pr diff` |
| `/mk:review --pending` | Pending | Staged + unstaged `git diff` |
| `/mk:review abc1234` | Commit | Single commit via `git show` |

## Quick Workflow

```
Input Mode Detection → Scope Drift Check → Two-Pass Review
  → Design Review (if frontend) → Test Coverage Audit
  → Fix-First Resolution → Adversarial Review (auto-scaled)
  → Verdict: APPROVE | REQUEST CHANGES | BLOCK
```

Verdict rules:
- **APPROVE** — zero critical findings across all passes
- **REQUEST CHANGES** — 1+ critical findings that can be fixed
- **BLOCK** — security vulnerability, spec violation, or 3+ unresolved critical findings

::: info Skill Details
**Phase:** 4  
**Used by:** reviewer agent  
**Plan-First Gate:** Reads plan for context. Skips for standalone PR diff reviews.
:::

## Iterative Evaluation (v2.0)

For high-stakes code (payments, auth, security) or with `--iterative` flag, review runs multiple passes:

1. **Pass 1** — Full adversarial review (existing workflow)
2. Developer fixes all FAIL/WARN items
3. **Pass 2** — Re-review focusing on changed code + previously flagged items
4. If still FAIL → developer fixes → **Pass 3** (final)

**Max 3 iterations.** After 3, escalate to user regardless. The reviewer never implements fixes; the developer never self-evaluates.

Loaded from: `references/iterative-evaluation-protocol.md`

## Gotchas

- **Reviewing diff without full context**: Approving a change that breaks an unstated invariant → Always read the surrounding file, not just the diff hunks
- **Style nits hiding real bugs**: 10 comments about formatting, zero about the missing null check → Prioritize: security > correctness > performance > style
- **Iterative mode on trivial code**: Only use for payments, auth, security, or public APIs. Standard review is one-shot.
- **Design checklist fires only on frontend diffs**: `design-checklist.md` runs only when `meowkit-diff-scope` reports `SCOPE_FRONTEND=true`. Backend-only, config-only, or prompt-only PRs skip it silently. If you expect design findings and see none, check whether the diff actually touched frontend files.
- **Design checklist is source-pattern-based, not visual**: It grep-detects anti-patterns (purple gradients, `outline: none`, `!important`, skip-to-content absence). It does NOT render the UI or compare screenshots. `[LOW]` tier items especially need human visual verification — treat them as "possible" hints, not findings.

## Related

- [`mk:ship`](/reference/skills/ship) — Runs review as part of the ship pipeline
- [`mk:cso`](/reference/skills/cso) — Dedicated security audit (deeper than review's security pass)
- [`mk:qa-manual`](/reference/skills/qa-manual) — QA testing complements code review
