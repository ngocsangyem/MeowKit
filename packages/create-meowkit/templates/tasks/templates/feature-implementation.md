---
title: "[FEATURE TITLE]"
type: feature-implementation
status: draft
phase: 1
priority: medium
effort: medium
created: YYYY-MM-DD
branch: feat/kebab-feature-name
agent: ""
---

# [FEATURE TITLE]

<!-- Agent fills: Replace all [PLACEHOLDERS] before Gate 1. Do not start Phase 2 without approval. -->

## Goal

<!-- One sentence. Describe the outcome, not the work. -->
[As a result of this feature, USERS can DO THING so that BENEFIT.]

## Context

<!-- Max 5 bullets. What exists now? Why does this matter? -->
- Current state: [what exists today]
- Problem: [what gap or pain this addresses]
- Trigger: [what prompted this now]
- Prior art: [related tasks, ADRs, or decisions]
- Constraints: [technical or business limits already known]

## User Story

As a [role],
I want [capability],
so that [benefit].

## Scope

**In scope:**
- [specific behavior 1]
- [specific behavior 2]

**Out of scope:**
- [explicitly excluded thing 1]
- [explicitly excluded thing 2]

## Constraints

<!-- Imperative language. What MUST NOT change. -->
- MUST preserve backward compatibility with [API/contract/data shape]
- Do NOT modify [file/module] — owned by [team/agent]
- MUST pass all existing tests (no regressions)
- [Add security, performance, or compliance constraints here]

## Technical Approach

### Phase 2 — Test Plan (RED)

<!-- Agent fills: Write these tests BEFORE any implementation. -->
- [ ] Unit: [describe test — what input, what expected output]
- [ ] Unit: [describe test — edge case]
- [ ] Integration: [describe end-to-end scenario]
- [ ] Error case: [describe failure condition and expected behavior]

### Phase 3 — Implementation Plan

<!-- Agent fills: Numbered steps. Each step = one coherent change. -->
1. [First discrete implementation step]
2. [Second step]
3. [Third step]

### Phase 4 — Review Checklist

- [ ] All acceptance criteria pass
- [ ] No `any` types introduced
- [ ] No hardcoded secrets or credentials
- [ ] Error paths handled and tested
- [ ] Security rules checked (see `.claude/rules/security-rules.md`)

## Acceptance Criteria

<!-- Binary only. Each item must be independently verifiable. -->
- [ ] [Specific, testable criterion — e.g., "GET /api/users returns 200 with array"]
- [ ] [Specific, testable criterion]
- [ ] [Specific, testable criterion]
- [ ] All existing tests pass (no regressions)
- [ ] TypeScript compiles with zero errors

## API Changes

<!-- Optional. Remove section if no API changes. -->
| Method | Path | Request | Response | Auth |
|--------|------|---------|----------|------|
| POST | /api/[route] | `{ field: type }` | `{ field: type }` | required |

## Related

<!-- Agent fills: file paths, ADRs, issues, prior tasks -->
- Implementation files: `src/[module]/`
- Test files: `tests/[module]/`
- Related ADR: `docs/architecture/[adr-file].md`

## Agent State

<!-- Agent fills after every significant action. Keep current. -->
Current phase: 1 — Planning
Last action: Task file created
Next action: Get Gate 1 approval before writing any tests or code
Blockers: none
Decisions made: none yet
