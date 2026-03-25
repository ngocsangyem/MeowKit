# Phase {XX}: {Phase Name}

<!-- AGENT USAGE: Template for a single phase within a multi-phase plan.
     Referenced from plan-template.md when plan has > 3 phases.
     Save to: tasks/plans/YYMMDD-feature-name/phase-XX-name.md -->

---
parent_plan: tasks/plans/YYMMDD-feature-name.md
phase_number: {XX}
status: not-started | in-progress | done | blocked
depends_on: [phase numbers this depends on, e.g., "01, 02"]
---

## Scope

{What this phase covers. What is IN scope and what is NOT.}

## Context Links

- **Parent plan**: `{parent_plan}`
- **Previous phase**: `phase-{XX-1}-name.md` | none
- **Related files**: list of files this phase reads or modifies
- **Reference docs**: links to relevant documentation

## Key Insights

{Important findings from research or previous phases. Critical considerations.}

## Requirements

### Functional
- [ ] {Requirement}
- [ ] {Requirement}

### Non-Functional
- [ ] {Performance/security/scalability requirement}

## Related Code Files

### Files to modify
- `path/to/file.ext` — {what changes}

### Files to create
- `path/to/new-file.ext` — {purpose}

### Files to delete
- none | `path/to/file.ext` — {why}

## Implementation Steps

1. [ ] {Step} — `path/to/file.ext`
2. [ ] {Step} — `path/to/file.ext`
3. [ ] {Step} — `path/to/file.ext`

## Phase Acceptance Criteria

- [ ] {Binary pass/fail condition}
- [ ] {Binary pass/fail condition}
- [ ] Tests pass for this phase's changes

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| {risk} | {level} | {mitigation} |

## Security Considerations

- [ ] {Relevant security check}

## Next Steps

{What the next phase should pick up. Dependencies to pass forward.}
