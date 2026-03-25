# Skill: Structural Code Audit

**Purpose:** Perform a deep, structured code review across 5 dimensions. Produce a verdict file with PASS/WARN/FAIL per dimension.

## When to Use

Invoke this skill during code review — after tests pass but before approving a change for shipping.

---

## The 5 Dimensions

### Dimension 1: Architecture

**Question:** Does the change fit existing module boundaries? Are new dependencies justified?

**Check for:**
- [ ] New code is placed in the correct module/directory
- [ ] No circular dependencies introduced
- [ ] New dependencies are justified (not duplicating existing functionality)
- [ ] Module boundaries are respected (no reaching into another module's internals)
- [ ] If a new module is created, it follows existing patterns

**Verdict criteria:**
- **PASS** — change fits cleanly into existing architecture
- **WARN** — minor boundary issues or questionable dependency
- **FAIL** — architectural violation, circular dependency, or unjustified new dependency

### Dimension 2: Type Safety

**Question:** Is the code fully and correctly typed?

**Check for:**
- [ ] No `any` type usage (TypeScript) or equivalent type erasure
- [ ] No unsafe type assertions (`as unknown as X`, force unwrap without guard)
- [ ] All public API functions have explicit return types
- [ ] Generic types are used correctly (no overly broad or overly narrow)
- [ ] Null/undefined handling is explicit (no implicit optional chaining chains)

**Verdict criteria:**
- **PASS** — fully typed, no unsafe assertions
- **WARN** — minor type issues that don't affect runtime safety
- **FAIL** — `any` usage, missing return types on public APIs, unsafe assertions

### Dimension 3: Test Coverage

**Question:** Is the change adequately tested? Are edge cases covered?

**Check for:**
- [ ] New functionality has corresponding tests
- [ ] Happy path is tested
- [ ] Error/edge cases are tested (null input, empty arrays, boundary values)
- [ ] Integration points are tested (API calls, database queries)
- [ ] Tests are meaningful (not just asserting `true === true`)

**Verdict criteria:**
- **PASS** — comprehensive tests including edge cases
- **WARN** — happy path tested but edge cases missing
- **FAIL** — no tests for new functionality, or tests are trivial/meaningless

### Dimension 4: Security

**Question:** Does the change introduce security vulnerabilities?

**Check for:**
- [ ] Run full security checklist (see `review/security-checklist.md`)
- [ ] Input validation on all user-provided data
- [ ] Authentication/authorization checks present
- [ ] No sensitive data exposure (logs, error messages, responses)
- [ ] No injection vulnerabilities (SQL, XSS, command injection)

**Verdict criteria:**
- **PASS** — no security issues found
- **WARN** — minor issues with low exploitability
- **FAIL** — any exploitable vulnerability, missing auth, or data exposure

### Dimension 5: Performance

**Question:** Does the change introduce performance concerns?

**Check for:**
- [ ] No N+1 query patterns (loading related data in a loop)
- [ ] No blocking I/O in async context (sync file reads, blocking HTTP calls)
- [ ] No unnecessary re-renders in frontend (missing memoization, unstable keys)
- [ ] No large bundle additions without justification
- [ ] Database queries use appropriate indexes
- [ ] No unbounded data fetching (missing pagination/limits)

**Verdict criteria:**
- **PASS** — no performance concerns
- **WARN** — minor issues unlikely to affect production at current scale
- **FAIL** — N+1 queries, blocking I/O, or unbounded data fetching

---

## Output: Verdict File

Generate a verdict file at `reviews/[branch-or-pr-name]-audit.md`:

```markdown
# Structural Audit: [Change Description]

**Date:** YYYY-MM-DD
**Reviewer:** [agent or human]
**Change:** [PR link or branch name]

## Verdicts

| Dimension | Verdict | Notes |
|-----------|---------|-------|
| Architecture | PASS/WARN/FAIL | [brief explanation] |
| Type Safety | PASS/WARN/FAIL | [brief explanation] |
| Test Coverage | PASS/WARN/FAIL | [brief explanation] |
| Security | PASS/WARN/FAIL | [brief explanation] |
| Performance | PASS/WARN/FAIL | [brief explanation] |

## Overall: PASS / WARN / FAIL

## Issues Found
1. [Issue description — dimension — severity]
2. ...

## Recommendations
1. [Recommendation]
2. ...
```

## Overall Verdict Rules

- **PASS** — all dimensions PASS
- **WARN** — at least one WARN, no FAIL
- **FAIL** — any dimension is FAIL

A change with overall FAIL must NOT be shipped until all FAIL dimensions are resolved.
