# Skill: Structured Plan Creation

**Purpose:** Create well-structured plans with consistent format, clear success criteria, and explicit scope boundaries.

## When to Use

Invoke this skill whenever a new feature, project, or initiative needs planning before implementation begins.

## Plan File Format

Create the plan as a markdown file with YAML frontmatter.

### Frontmatter

```yaml
---
status: draft | approved | in-progress | completed
created: YYYY-MM-DD
author: [name]
complexity: trivial | standard | complex
---
```

**Complexity guide:**
- `trivial` — single file change, no new dependencies, < 3 tasks
- `standard` — multiple files, known patterns, 3-10 tasks
- `complex` — new patterns, multiple modules, cross-cutting concerns, > 10 tasks

### Plan Body

```markdown
# [Plan Title]

## Problem Statement

[1-3 paragraphs. What problem does this solve? Who is affected? What happens if we don't solve it?]

## Success Criteria

Measurable outcomes that determine when this work is done:

- [ ] [Criterion 1 — specific, testable, measurable]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

Each criterion must answer: "How would someone verify this is complete without asking the author?"

## Out of Scope

Explicit exclusions to prevent scope creep:

- [Thing that might seem related but is NOT part of this work]
- [Adjacent feature that will be handled separately]
- [Edge case we are deliberately ignoring and why]

## Technical Approach

### Chosen Approach

[Describe the approach in enough detail that another developer could implement it.]

### Alternatives Considered

| Approach | Why not chosen |
|----------|---------------|
| [Alt 1] | [Reason] |
| [Alt 2] | [Reason] |

## Risk Flags

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [Risk 1] | low/med/high | low/med/high | [What we do about it] |
| [Risk 2] | ... | ... | ... |

## Estimated Effort

Total tasks: [N]

| Task | Complexity | Dependencies |
|------|-----------|-------------|
| [Task 1] | trivial/standard/complex | None |
| [Task 2] | ... | Task 1 |

Note: Estimate in task count, NOT hours. Each task should be completable in a single focused session.

## Dependencies

- **Blocked by:** [What must happen before this work can start]
- **Blocks:** [What is waiting on this work]
- **External:** [Third-party dependencies, API availability, etc.]
```

## Steps to Execute

1. Gather requirements from the user or request context.
2. Fill in frontmatter — set status to `draft`, created to today's date, assess complexity.
3. Write Problem Statement — focus on the "why," not the "how."
4. Define Success Criteria — each must be independently verifiable.
5. Explicitly list Out of Scope items — ask: "What might someone assume is included but isn't?"
6. Describe Technical Approach — include at least one alternative considered.
7. Identify Risk Flags — at minimum, consider: technical risk, scope risk, dependency risk.
8. Break work into tasks — each task is a single deliverable unit.
9. List Dependencies — both internal and external.

## Validation Checklist

- [ ] Frontmatter is complete
- [ ] Problem Statement explains "why" not just "what"
- [ ] At least 3 measurable success criteria
- [ ] Out of Scope has at least 1 entry
- [ ] At least 1 alternative approach is listed
- [ ] All risks have mitigations
- [ ] Tasks are granular enough to complete in one session
- [ ] Dependencies are identified
