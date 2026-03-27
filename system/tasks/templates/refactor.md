---
title: "Refactor: [MODULE OR CONCERN]"
type: refactor
status: draft
phase: 1
priority: medium
effort: medium
created: YYYY-MM-DD
branch: refactor/kebab-description
agent: ""
---

# Refactor: [MODULE OR CONCERN]

<!-- Agent fills: Complete all sections before Gate 1. Zero behavior changes — tests prove it. -->

## Goal

<!-- One sentence. What structural property will be true after this refactor? -->
[After this refactor, CODEBASE PROPERTY (e.g., AuthService is stateless / no circular deps / all DB calls go through repository layer).]

## Motivation

<!-- Why now? Cite observable problems — not taste. -->
- **Symptom:** [e.g., every new feature touches 5 files due to tight coupling]
- **Metric:** [e.g., auth.ts is 420 lines; average file is 95 lines]
- **Risk if not done:** [e.g., adding OAuth will require rewriting auth.ts anyway]

## Current State

```
[ASCII or text diagram of what exists now — modules, dependencies, data flow]
```

Key problems:
- [Specific structural problem 1 — file:line if possible]
- [Specific structural problem 2]

## Target State

```
[ASCII or text diagram of target structure]
```

Properties after refactor:
- [e.g., AuthService has single responsibility: token validation only]
- [e.g., No module imports from more than 2 levels deep]

## Scope

**In scope:**
- [Specific files or modules being restructured]
- [Specific concern being extracted or merged]

**Out of scope:**
- New features — none. This is structural change only.
- Bug fixes — file separately if found during refactor

## Constraints

- MUST NOT change any externally observable behavior
- MUST NOT change public API signatures
- MUST pass all existing tests before, during, and after each step
- Do NOT add new functionality — this is a refactor, not a feature

## Refactor Strategy

<!-- Choose one and explain why it fits. -->
- [ ] **Strangler fig** — incrementally replace old structure alongside new (safest for large modules)
- [ ] **Incremental extraction** — pull out one concern at a time, test after each
- [ ] **Big bang** — rewrite in one pass then verify (only for small, well-tested modules)

Chosen: [strategy] because [reason].

Steps:
1. [First discrete structural change — e.g., "Extract TokenValidator class from auth.ts"]
2. [Second step]
3. [Third step — each step leaves tests green]

## Backward Compatibility

<!-- What contracts must be preserved? -->
- Public exports from `src/[module]/index.ts` — same names, same signatures
- [Other contract that must not break]

## Verification

- [ ] All tests pass before first change (baseline)
- [ ] All tests pass after EACH step (no batch-then-test)
- [ ] No new `any` types introduced during restructuring
- [ ] Bundle size does not increase by more than [N]%
- [ ] TypeScript compiles with zero errors at every step

## Acceptance Criteria

- [ ] All existing tests pass (identical test suite, no deletions to make tests pass)
- [ ] [Specific structural property — e.g., "No file exceeds 150 lines"]
- [ ] [Specific dependency property — e.g., "auth.ts has zero imports from user.ts"]
- [ ] TypeScript compiles with zero errors
- [ ] No behavior change observable from outside the refactored boundary

## Related

- Files being changed: `src/[module]/`
- Test files: `tests/[module]/`
- Related ADR: `docs/architecture/[adr-file].md`

## Agent State

<!-- Agent fills after every significant action. Keep current. -->
Current phase: 1 — Planning
Last action: Task file created
Next action: Run existing tests to establish baseline, then get Gate 1 approval
Blockers: none
Decisions made: none yet
