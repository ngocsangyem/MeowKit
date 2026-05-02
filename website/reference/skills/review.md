---
title: "mk:review"
description: "Multi-pass structural code review with adversarial analysis, scope-aware dispatch, adversarial persona passes, and forced-finding protocol. Supports branch diff, PR number, commit hash, and pending changes."
---

# mk:review

## What This Skill Does

Performs a multi-pass adversarial code review using a step-file architecture. Three parallel base reviewers examine the code independently from different angles (blind code smells, edge-case tracing, criteria mapping). For non-trivial diffs, adversarial persona passes challenge findings deeper -- security adversary, failure mode analyst, assumption destroyer, and scope critic. A forced-finding protocol prevents rubber-stamp approvals. Produces a 5-dimension verdict (Correctness, Maintainability, Performance, Security, Coverage) that gates Phase 5 (Ship).

## When to Use

- User asks to "review this PR", "code review", "pre-landing review", "check my diff"
- User is about to merge or land code changes (proactive suggestion)
- Before running `mk:ship` to ensure quality gate passes
- **NOT** for behavioral verification against a running build -- use `mk:evaluate`
- **NOT** for post-implementation simplification -- use `mk:simplify`
- **NOT** for whole-repo security audit (infra, supply chain, secrets archaeology) -- use `mk:cso`
- **Recommended:** Run `mk:scout` first for changes touching 3+ files to identify cross-file risks

## Core Capabilities

### Phase A -- Base Reviewers (3 Parallel Layers)

1. **Blind Hunter** -- Reviews ONLY the diff. No plan, no spec. Catches code smells and obvious bugs.
2. **Edge Case Hunter** -- Traces every branch, boundary, null path. Finds what breaks at edges.
3. **Criteria Auditor** -- Maps each plan acceptance criterion to implementation. Verifies test coverage.

### Phase B -- Adversarial Persona Passes (Full Scope Only)

After Phase A completes, separate persona subagents receive the diff AND a summary of Phase A findings. They go deeper -- not wider -- challenging what base reviewers missed:

1. **Security Adversary** -- Attack surface, injection vectors, auth bypass, supply chain
2. **Failure Mode Analyst** -- Race conditions, partial failures, cascading errors, data loss
3. **Assumption Destroyer** -- Implicit assumptions, unvalidated inputs, edge cases (high-domain only)
4. **Scope Complexity Critic** -- Over-engineering, YAGNI violations, scope creep (high-domain only)

### Scope Gate

Step-01 assesses diff complexity and sets review scope:
- **Minimal** (<=3 files, <=50 lines, no security files, domain != high) -- Blind Hunter only, no personas
- **Full** -- All 3 base reviewers + personas based on domain complexity

### Forced-Finding Protocol

If total findings across all reviewers = 0, triggers ONE re-analysis with "look harder" prompt. Prevents rubber-stamp approvals.

### 5-Dimension Verdict

| Dimension | PASS | WARN | FAIL |
|-----------|------|------|------|
| Correctness | No CRITICAL/MAJOR bugs | MINOR bugs only | Any CRITICAL bug |
| Maintainability | Clean, conventions followed | Style issues | Unreadable, violates architecture |
| Performance | No regressions | Potential issues flagged | Proven regression |
| Security | No security findings | MINOR security notes | Any CRITICAL security issue |
| Coverage | All ACs covered + tested | Partial AC coverage | Missing AC implementation |

**Verdict rules:** Any FAIL -> Overall FAIL -> Gate 2 blocks. All PASS -> PASS. Mix PASS/WARN -> WARN.

### Artifact Verification (Full Scope Only)

4-level post-verdict check:
- **Level 1 (Exists):** Files compile, exports valid
- **Level 2 (Substantive):** Scan for stubs (TODO, empty bodies, placeholder strings, empty catch blocks)
- **Level 3 (Wired):** Verify each new export has at least one consumer
- **Level 4 (Data Flowing):** Flag unused params, ignored returns, hardcoded responses (informational)

### Input Modes

| Input | Mode | What Gets Reviewed |
|-------|------|--------------------|
| _(no args)_ | Branch diff | Current branch diff against base branch |
| `--pending` | Pending | Staged + unstaged changes via `git diff` + `git diff --cached` |
| `#123` or PR URL | PR | Full PR diff via `gh pr diff 123` |
| `abc1234` (7+ hex chars) | Commit | Single commit diff via `git show abc1234` |

## Workflow

```
workflow.md -> step-01 -> step-02 (Phase A) -> step-02b (Phase B, full only) -> step-03 -> step-03b -> step-04
```

1. **step-01-gather-context** -- Load diff, plan, acceptance criteria. Assess `review_scope` (minimal/full) and `domain_complexity`. Check for red-team findings from prior passes.
2. **step-02-parallel-review** -- Phase A: Dispatch base reviewers based on scope. Minimal = Blind Hunter only. Full = all 3 in parallel.
3. **step-02b-persona-passes** -- Phase B (full scope only): Dispatch adversarial persona subagents informed by Phase A findings, 2-at-a-time batching.
4. **step-03-triage** -- Forced-finding check (zero -> re-analyze once). Categorize findings as `current-change` or `incidental`. Dedup Phase A + Phase B.
5. **step-03b-whole-plan-sweep** -- Cross-file drift detection after edits (skipped if no active plan).
6. **step-04-verdict** -- 5-dimension verdict + artifact verification. Present for Gate 2 approval.

## Usage

```bash
/mk:review                  # Current branch diff (default)
/mk:review #42              # Specific PR by number
/mk:review abc1234          # Specific commit hash
/mk:review --pending        # Uncommitted staged + unstaged changes
```

## Example Prompt

> "I just finished the auth refactor. Can you review it before I merge? /mk:review"

If the diff is >3 files (>50 lines, security-relevant auth files): scope = full. Phase A runs 3 reviewers in parallel (Blind Hunter catches a missing null check, Edge Case Hunter finds an edge case on expired tokens, Criteria Auditor confirms all acceptance criteria are covered). Phase B dispatches Security Adversary (finds token stored in localStorage) and Failure Mode Analyst (finds race condition in refresh token flow). Triage deduplicates, categorizes, and the verdict: Security = FAIL (CRITICAL token storage issue). Gate 2 blocks.

## Common Use Cases

- **Pre-merge PR review:** Full adversarial review before landing changes
- **Quick sanity check:** Minimal scope for small 1-2 file diffs (Blind Hunter only)
- **Security-sensitive changes:** Full scope with persona passes triggered by auth/payment/encryption file changes
- **Pending change review:** Review uncommitted work with `--pending` before staging
- **Commit-specific review:** Review a single commit in isolation

## Pro Tips

- **Run `mk:scout` first for 3+ file changes** -- scout identifies cross-file risks that blind review misses; makes the review more targeted
- **The scope gate is automatic** -- small diffs skip the full adversarial pipeline; you don't need to choose
- **FAIL verdict blocks `mk:ship`** -- this is enforced by Gate 2; fix issues and re-review before shipping
- **Artifact verification catches stubs** -- Level 2 scan finds TODO comments, empty catch blocks, placeholder strings that might ship accidentally
- **Review failure catalog** lists common rationalizations to avoid (e.g., "AI-generated code is probably fine" -- it needs MORE scrutiny)
- **Design checklist fires only on frontend diffs** -- backend-only PRs skip visual anti-pattern detection silently
- **Post-verdict, optionally run `mk:elicit`** for deeper analysis (pre-mortem, red-team, socratic, first-principles) on WARN verdicts
- **The skill writes patterns to `.claude/memory/review-patterns.md`** -- building institutional review knowledge over time

> **Canonical source:** `.claude/skills/review/SKILL.md`
