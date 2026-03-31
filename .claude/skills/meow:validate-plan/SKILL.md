---
name: meow:validate-plan
version: 1.0.0
preamble-tier: 3
description: >-
  Validates an approved plan against 8 dimensions before Phase 3 begins.
  Catches incomplete acceptance criteria, missing dependencies, and unresolved
  risks. Use after Gate 1 approval and before Phase 2 (Test RED). Produces a
  validation report with pass/fail per dimension.
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
# Adapted for MeowKit's gate system — runs between Gate 1 and Phase 2
source: new
---

# Plan Validation — 8-Dimension Quality Check

Validates a plan file against 8 dimensions to catch gaps before implementation begins.
Does NOT replace Gate 1 (human approval). Supplements it with systematic checks.

## When to Use

- After Gate 1 approval, before Phase 2 (Test RED)
- When `/meow:cook` detects a COMPLEX task (auto-suggested)
- When user wants to stress-test a plan before committing to implementation
- When user says "validate this plan", "check my plan", "is this plan complete"

## 8 Validation Dimensions

| #   | Dimension                   | Pass Criteria                                                        | Common Failure                                               |
| --- | --------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | **Scope Clarity**           | In-scope and out-of-scope sections are explicit and non-overlapping  | Vague scope: "improve the auth system" without boundaries    |
| 2   | **Acceptance Criteria**     | Every criterion is binary (pass/fail), not subjective                | Subjective: "should feel fast" vs binary: "response < 200ms" |
| 3   | **Dependencies Resolved**   | All external dependencies identified with status (available/blocked) | Missing: needs DB migration but not listed as dependency     |
| 4   | **Risks Identified**        | At least 1 risk flag with mitigation strategy                        | No risks listed (every plan has risks; zero = not evaluated) |
| 5   | **Architecture Documented** | Technical approach references existing patterns or includes ADR      | "We'll figure out the architecture during implementation"    |
| 6   | **Test Strategy**           | Test approach covers acceptance criteria; edge cases identified      | "We'll add tests after" (violates TDD)                       |
| 7   | **Security Considered**     | Auth, data access, input validation addressed (or explicitly N/A)    | No mention of security for a feature handling user data      |
| 8   | **Effort Estimated**        | Time/complexity estimate with confidence level                       | No estimate or "it depends" without qualification            |

## Workflow

1. **Load plan file** — Read from `tasks/plans/YYMMDD-name/plan.md`
2. **Check each dimension** — Evaluate against pass criteria
3. **Produce validation report** — Pass/fail per dimension with findings
4. **Route result:**
   - All 8 PASS → proceed to Phase 2
   - Any FAIL → return to planner with specific revision requests
   - WARN (partially met) → user decides: proceed or revise

## Output Format

```markdown
## Plan Validation: [Plan Name]

| #   | Dimension               | Status         | Finding            |
| --- | ----------------------- | -------------- | ------------------ |
| 1   | Scope Clarity           | PASS/FAIL/WARN | [specific finding] |
| 2   | Acceptance Criteria     | PASS/FAIL/WARN | [specific finding] |
| 3   | Dependencies Resolved   | PASS/FAIL/WARN | [specific finding] |
| 4   | Risks Identified        | PASS/FAIL/WARN | [specific finding] |
| 5   | Architecture Documented | PASS/FAIL/WARN | [specific finding] |
| 6   | Test Strategy           | PASS/FAIL/WARN | [specific finding] |
| 7   | Security Considered     | PASS/FAIL/WARN | [specific finding] |
| 8   | Effort Estimated        | PASS/FAIL/WARN | [specific finding] |

**Result:** [N]/8 passed | [Action: proceed / revise dimensions X,Y]
```

## Integration with Cook Workflow

In `/meow:cook`, validation runs automatically for COMPLEX tasks:

```
Gate 1 (plan approved) → meow:validate-plan → Phase 2 (Test RED)
```

For STANDARD tasks, validation is optional (user-triggered).
For TRIVIAL tasks, validation is skipped.

## Gotchas

- **Not the same as `validate-plan.py`**: The script at `meow:plan-creator/scripts/validate-plan.py` validates plan file *structure* (required sections exist). This skill validates plan *content quality* (are acceptance criteria binary? are risks identified?). Both can run — they check different things.

## What This Skill Does NOT Do

- Does NOT replace Gate 1 — human approval still required
- Does NOT modify plan files — read-only analysis
- Does NOT generate tests — that's Phase 2 (tester agent)
- Does NOT block Gate 1 — runs after Gate 1, before Phase 2
