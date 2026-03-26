---
title: "meow:review"
description: "Multi-pass code review with scope drift detection, adversarial red-teaming, test coverage audit, and fix-first resolution."
---

# meow:review

Multi-pass code review with scope drift detection, adversarial red-teaming, test coverage audit, and fix-first resolution.

## What This Skill Does

`meow:review` runs a comprehensive 15-step code review that goes far beyond "looks good." It detects scope drift against your plan, applies a two-pass checklist (critical → informational), audits test coverage, runs a design review on frontend files, performs adversarial red-teaming scaled by diff size, and auto-fixes trivial issues before asking about non-trivial ones. The final verdict (APPROVE / REQUEST CHANGES / BLOCK) gates whether `meow:ship` can execute.

## Core Capabilities

- **Multiple input modes** — Branch diff (default), PR number (`#42`), commit hash, or pending changes (`--pending`)
- **Scope drift detection** — Compares diff against plan file, TODOS.md, and PR description to catch creep and missing requirements
- **Two-pass checklist** — Pass 1 checks critical issues (SQL injection, race conditions, auth bypass), Pass 2 checks informational (dead code, style)
- **Test coverage audit** — Traces code paths, generates coverage diagram, writes tests for gaps
- **Adversarial review** — Auto-scaled: <50 lines skipped, 50-199 lines cross-model challenge, 200+ lines full battery
- **Fix-first resolution** — Classifies findings as AUTO-FIX or ASK; fixes trivial issues, batch-asks about the rest
- **Verdict gating** — BLOCK verdict prevents `meow:ship` from executing

## When to Use This

::: tip Use meow:review when...
- You're about to merge or ship code
- You want a thorough review before creating a PR
- You need to review someone else's PR
- You want to check uncommitted changes before committing
:::

## Usage

```bash
# Review current branch diff (default)
/meow:review

# Review a specific PR
/meow:review #42

# Review uncommitted changes
/meow:review --pending

# Review a specific commit
/meow:review abc1234
```

## Example Prompts

| Prompt | Input mode | What gets reviewed |
|--------|-----------|-------------------|
| `/meow:review` | Branch diff | Current branch vs base branch |
| `/meow:review #42` | PR | Full PR diff via `gh pr diff` |
| `/meow:review --pending` | Pending | Staged + unstaged `git diff` |
| `/meow:review abc1234` | Commit | Single commit via `git show` |

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

## Related

- [`meow:ship`](/reference/skills/ship) — Runs review as part of the ship pipeline
- [`meow:cso`](/reference/skills/cso) — Dedicated security audit (deeper than review's security pass)
- [`meow:qa-manual`](/reference/skills/qa-manual) — QA testing complements code review
