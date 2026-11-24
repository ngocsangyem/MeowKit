---
name: mk:nyquist
version: 1.0.0
preamble-tier: 3
description: "Maps acceptance criteria to tests. NOT for mk:testing."
allowed-tools:
  - Read
  - Grep
  - Glob
source: new
keywords:
  - nyquist
  - test-coverage
  - requirement-mapping
  - coverage-gap
  - acceptance-criteria
when_to_use: "Do tests cover criteria?"
user-invocable: true
owner: research
criticality: medium
status: active
runtime: claude-code
---

# Nyquist — Test-to-Requirement Coverage Mapping

Goal: a standalone map from each acceptance criterion to the tests that name it, with the gaps listed. The map reads test names; it does not run tests or read assertions, so it says "name-matched", not "covered".

Inside a diff review, `mk:review`'s Criteria Auditor does the same job; use this skill when you want the requirement-to-test map on its own.

## When to Use

- Phase 2 (Test): After tester writes initial tests, verify all acceptance criteria are covered
- Phase 4 (Review): As part of test coverage dimension, verify no gaps
- User says "check test coverage", "are all requirements tested", "coverage gaps"
- Before shipping: verify implementation matches plan

## Workflow

1. **Load plan** — Read `tasks/plans/YYMMDD-name/plan.md`, extract acceptance criteria. If there is no plan or it has no acceptance criteria, ask the user for them and stop; there is nothing to map
2. **Scan tests** — Glob for test files (`**/*.test.*`, `**/*.spec.*`, `**/test_*.*`)
3. **Map criteria → tests** — For each acceptance criterion, search test descriptions/names for matching keywords
4. **Identify gaps** — Criteria with no matching test = coverage gap
5. **Produce report** — Structured output with mapping table and gap list, in chat; if the user asks to keep it, save it as `tasks/reports/nyquist-{date}-{slug}.md`

## Output Format

```markdown
## Nyquist Coverage Report: [Plan Name]

### Requirement-to-Test Mapping

| # | Acceptance Criterion | Test File | Test Name | Status |
|---|---------------------|-----------|-----------|--------|
| 1 | [criterion text] | src/auth.test.ts | "should authenticate user" | NAME-MATCHED |
| 2 | [criterion text] | — | — | GAP |
| 3 | [criterion text] | src/api.test.ts | "returns 404 for missing" | NAME-MATCHED |

### Coverage Summary

- **Total criteria:** N
- **Name-matched:** N (N%) — names only; assertions not read
- **Gaps:** N

### Gap Details

1. **[criterion text]** — No test found. Suggested test: [brief description]
2. **[criterion text]** — No test found. Suggested test: [brief description]

### Recommendation

[All criteria name-matched (assertions not checked) | N gaps found, suggest adding tests]
```

## Matching Strategy

- **Keyword matching:** Extract key nouns/verbs from acceptance criteria, search in test `describe`/`it`/`test` strings
- **File path matching:** If criterion mentions "auth", search in `**/auth*test*`
- **Fuzzy matching:** If exact match fails, check for semantic equivalents (e.g., "login" ≈ "authenticate")
- **Manual override:** If no match found, ask user to confirm the gap is real (not a naming mismatch)

## Gotchas

- **Renamed or reworded tests look like gaps**: keyword matching misses a test whose name no longer echoes the criterion. Ask the user to confirm a gap before reporting it as real.

## What This Skill Does NOT Do

- Does NOT write tests — that's the tester agent's job
- Does NOT modify plan files — read-only analysis
- Does NOT replace manual review of test quality — only checks existence, not correctness
- Does NOT run tests — only reads test file contents
