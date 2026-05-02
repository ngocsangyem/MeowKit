---
title: "mk:validate-plan"
description: "8-dimension plan quality check — catches incomplete acceptance criteria, missing dependencies, and unresolved risks before Phase 2."
---

# mk:validate-plan

Validates a plan file against 8 dimensions before implementation begins. Runs between Gate 1 approval and Phase 2 (Test). Does NOT replace Gate 1 — supplements it with systematic checks. For green-field harness sprints, use `mk:sprint-contract` instead.

## Core purpose

Catch gaps before they become implementation blockers. Every dimension has binary pass criteria — no subjective evaluation.

## When to use

- After Gate 1 approval, before Phase 2
- When `/mk:cook` detects a COMPLEX task (auto-suggested)
- User asks "validate this plan", "check my plan", "is this plan complete"

## 8 validation dimensions

| # | Dimension | Pass criteria | Common failure |
|---|-----------|--------------|----------------|
| 1 | Scope Clarity | In/out-of-scope explicit and non-overlapping | Vague: "improve the auth system" |
| 2 | Acceptance Criteria | Every criterion binary (pass/fail) | Subjective: "should feel fast" |
| 3 | Dependencies Resolved | All external deps identified with status | Missing: needs DB migration not listed |
| 4 | Risks Identified | ≥1 risk flag with mitigation | No risks listed (zero = not evaluated) |
| 5 | Architecture Documented | References existing patterns or ADR | "We'll figure it out during implementation" |
| 6 | Test Strategy | Covers ACs; edge cases identified | "We'll add tests after" |
| 7 | Security Considered | Auth, data, input validation addressed or N/A | No mention for user-data feature |
| 8 | Effort Estimated | Time/complexity with confidence level | No estimate or "it depends" |

## Process

1. Load plan file from `tasks/plans/YYMMDD-name/plan.md`
2. Check each dimension against pass criteria
3. Produce validation report — pass/fail per dimension with specific findings
4. Offer export options for team review (optional `AskUserQuestion`)

## Gotchas

- Not a replacement for Gate 1 — Gate 1 is human approval; this is automated quality check
- Does NOT validate harness sprint contracts — use `mk:sprint-contract` for that
