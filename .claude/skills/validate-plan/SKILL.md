---
name: mk:validate-plan
version: 1.0.0
preamble-tier: 3
description: "Checks an agreed plan across 8 dimensions. NOT for mk:plan-ceo-review."
allowed-tools:
  - Read
  - Grep
  - Glob
  - AskUserQuestion
source: new
keywords:
  - validate-plan
  - plan-validation
  - plan-quality-check
  - acceptance-criteria-check
  - 8-dimension-validation
when_to_use: "Pre-code check."
user-invocable: true
owner: lifecycle
criticality: high
status: active
runtime: claude-code
---

# Plan Validation

Audits an agreed plan across 8 dimensions and reports what is missing before anyone builds. It operates on plans from `mk:plan-creator`, reports only and never edits or gates: the planner revises, and the user decides whether to proceed. Run it once the plan is agreed, before building; plan-creator and the user decide when.

| The user wants | Skill |
|---|---|
| Is the agreed plan complete and executable? | this skill |
| Is the scope ambitious or right-sized? | `mk:plan-ceo-review` |
| An adversarial read with fixes | `mk:plan-creator red-team {path}` |
| To be interviewed on the plan's open decisions | `mk:plan-creator validate {path}` |
| A green-field harness sprint contract | `mk:sprint-contract` |

## Process

1. **Locate the plan.** Read `tasks/plans/YYMMDD-name/plan.md`. If it is missing or empty, say so and stop. A hard-mode plan with no phase files is also a stop: say so.
2. **Structure first.** Run `mewkit plan check --structural {plan}`. It checks that required sections exist; fix structure before judging content. This skill judges content quality, which the command does not.
3. **Check each dimension.** A dimension that does not apply (security on a docs-only plan, test strategy when tests are optional) is marked N/A with one reason. Everything else gets PASS, WARN or FAIL with a finding that cites `path:line`; a PASS cites the line that satisfies it.
4. **Consistency sweep** (hard-mode plans with phase files). Run the read-only pass of `.claude/skills/plan-creator/references/whole-plan-sweep.md`: build the deltas, search every plan file for stale references, and append the stale ones as `sweep_failures`. Sweep failures do not auto-FAIL; they are inconsistencies the planner reconciles.
5. **Report.** FAIL means the planner revises, with specific revision requests; WARN is the user's call to proceed or revise.

## Dimensions

| # | Dimension | Passes when | Common failure |
|---|---|---|---|
| 1 | Scope clarity | In and out of scope are explicit and do not overlap | "improve the auth system" with no boundary |
| 2 | Acceptance criteria | Every criterion is binary | "should feel fast" instead of "response under 200ms" |
| 3 | Dependencies resolved | External dependencies are named with their status | A DB migration is needed but not listed |
| 4 | Risks identified | At least one risk with a mitigation | No risks (zero means not evaluated) |
| 5 | Architecture documented | The approach references existing patterns or an ADR | "We'll figure out the architecture while building" |
| 6 | Test approach | A test approach covering the criteria and edge cases, or a stated reason none is needed | Tests deferred with no reason |
| 7 | Security considered | Auth, data access and input validation addressed, or explicitly N/A | Nothing on security for a feature handling user data |
| 8 | Effort estimated | An estimate with a confidence level | No estimate, or "it depends" |

## Output

```markdown
## Plan Validation: [Plan Name]

| # | Dimension | Status | Finding (path:line) |
|---|---|---|---|
| 1 | Scope clarity | PASS/WARN/FAIL/N/A | ... |
...
**Result:** N of M applicable dimensions passed | proceed / revise dimensions X, Y
sweep_failures:
  - phase-02.md:18 references `userController` (renamed to `authController` at plan.md:42)
```

## Gotchas

- `mewkit plan check --structural` and this skill check different things: structure versus content quality. Run both.
- It does not modify plan files, generate tests or block anything: read-only analysis. It does not replace the user's own read of the plan.
- The word "validate" also names the plan-creator interview (`/mk:plan-creator validate`), a different thing: that asks the user decisions and writes answers in.
