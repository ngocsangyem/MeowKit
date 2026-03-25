# {Plan Title}

<!-- AGENT USAGE: When creating a new plan, copy this template.
     Fill ALL sections. Do NOT skip Constraints or Acceptance Criteria.
     Use plan-quick.md for tasks touching < 5 files or < 2 hours.
     Use plan-phase.md for individual phases of multi-phase plans.
     Save to: tasks/plans/YYMMDD-feature-name.md -->

---
title: {Plan Title}
status: draft | approved | in-progress | blocked | done
priority: critical | high | medium | low
effort: trivial | small | medium | large
created: YYYY-MM-DD
branch: feature/YYMMDD-feature-name
tags: [feature, bugfix, refactor, security, docs]
model_tier: TRIVIAL | STANDARD | COMPLEX
---

## Goal

{One sentence: what does success look like when this plan is complete?}

## Context

<!-- Place long background content HERE at the top.
     Queries at the bottom improve Claude's response quality by ~30%.
     Reference: claude-prompting-best-practices.md -->

### Current State
{What exists now. What the system currently does. 2-3 sentences max.}

### Problem
{What problem this solves and for whom. Why it matters.}

### Related
- **Previous plans**: `tasks/plans/{link}` | none
- **ADRs**: `docs/architecture/{link}` | none
- **Docs**: `docs/{link}` | none
- **Issues**: #{number} | none
- **Dependencies**: {external systems, APIs, other plans}

## Phases

### Phase 1: {Name}

**Scope**: {What this phase covers and its boundary}

#### Tasks
1. [ ] {Task description} — `path/to/file.ext`
2. [ ] {Task description} — `path/to/file.ext`
3. [ ] {Task description} — `path/to/file.ext`

#### Phase Acceptance
- [ ] {Binary pass/fail condition}
- [ ] {Binary pass/fail condition}

### Phase 2: {Name}

**Scope**: {What this phase covers}
**Depends on**: Phase 1

#### Tasks
1. [ ] {Task description} — `path/to/file.ext`
2. [ ] {Task description} — `path/to/file.ext`

#### Phase Acceptance
- [ ] {Binary pass/fail condition}

<!-- Add more phases as needed. For complex plans (> 3 phases),
     create separate phase-XX-name.md files using plan-phase.md template
     and link them here. -->

## Constraints

<!-- Explicit list of what MUST NOT change. Prevents scope creep.
     Reference: prompt-crafting-for-different-models.md — "Specify constraints explicitly" -->

- MUST NOT: {boundary 1 — e.g., "change the public API"}
- MUST NOT: {boundary 2 — e.g., "modify database schema"}
- MUST NOT: {boundary 3 — e.g., "break backward compatibility"}

## Acceptance Criteria

<!-- Binary pass/fail conditions for the ENTIRE plan.
     If any criterion fails, the plan is not complete.
     Reference: prompt-crafting-for-different-models.md — "Include acceptance criteria" -->

- [ ] {Measurable condition — e.g., "all existing tests pass"}
- [ ] {Measurable condition — e.g., "new endpoint returns 200 for valid input"}
- [ ] {Measurable condition — e.g., "security scan shows no BLOCK items"}
- [ ] Code review passed (Gate 2)

## Testing Strategy

- **Unit tests**: {what to test, coverage target}
- **Integration tests**: {key interaction points}
- **Manual verification**: {what to check by hand}

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| {risk} | {high/medium/low} | {mitigation} |

## Security Considerations

- [ ] {Security check relevant to this plan}
- [ ] No hardcoded secrets
- [ ] No new `any` types (TypeScript)

## Plan Status Log

<!-- Update this section as phases complete. Ensures plan is resumable
     across context window resets. Mark each item: Done / Blocked / Cancelled.
     Reference: codex-prompt-guide.md — plan closure rule -->

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 | {not-started/in-progress/done/blocked} | {brief note} |
| Phase 2 | {not-started/in-progress/done/blocked} | {brief note} |
