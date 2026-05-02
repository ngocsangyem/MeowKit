---
title: "mk:nyquist"
description: "Test-to-requirement coverage mapping — reads plan acceptance criteria and test files, produces a coverage gap report showing which requirements have no tests."
---

# mk:nyquist — Test-to-Requirement Coverage Mapping

## What This Skill Does

Analyzes plan acceptance criteria against existing test files to identify coverage gaps — requirements in the plan with no corresponding test. Named after the Nyquist sampling theorem: sufficient test coverage prevents aliased (missed) requirements.

This is a **read-only analysis** skill. It never modifies code or plans.

## When to Use

- **Phase 2 (Test):** After tester writes initial tests — verify all acceptance criteria are covered before implementation.
- **Phase 4 (Review):** As part of test coverage dimension — verify no gaps before shipping.
- **Before Gate 2:** Verify implementation matches plan.
- **Triggers:** "check test coverage", "are all requirements tested", "coverage gaps", "nyquist".

**NOT for:** running tests (`mk:testing`), structural code review (`mk:review`), writing tests (tester agent's job).

## Core Capabilities

### 5-Step Workflow

1. **Load plan** — Read `tasks/plans/YYMMDD-name/plan.md`, extract all acceptance criteria.
2. **Scan tests** — Glob for test files: `**/*.test.*`, `**/*.spec.*`, `**/test_*.*`.
3. **Map criteria to tests** — For each acceptance criterion, search test strings for matching keywords.
4. **Identify gaps** — Criteria with no matching test = coverage gap.
5. **Produce report** — Structured output with mapping table and gap list.

### Matching Strategy

| Strategy | How it works |
|---|---|
| **Keyword matching** | Extract key nouns/verbs from criteria, search in `describe`/`it`/`test` strings |
| **File path matching** | If criterion mentions "auth", search in `**/auth*test*` |
| **Fuzzy matching** | If exact match fails, check semantic equivalents (e.g., "login" ≈ "authenticate") |
| **Manual override** | If no match found, ask user to confirm gap is real (not a naming mismatch) |

### Output Format

## Example Prompt

> /mk:nyquist
> Before we start building the user onboarding flow, check if all acceptance criteria from the plan have corresponding tests. Show me the coverage gap report — which requirements have no test at all and which have only partial coverage.
