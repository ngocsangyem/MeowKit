# Phase 9: Explicit Research Linking + Critical-Step Tasks

## Context Links

- [Red-Team Report: Research Pipeline](../reports/red-team-260401-2034-plan-creator-vs-ck-plan-comparison.md) — "meow research linking implicit; ck uses Context Links"
- [Red-Team Report: Task Hydration](../reports/red-team-260401-2034-plan-creator-vs-ck-plan-comparison.md) — "ck creates tasks for critical steps, not just phases"

## Overview

- **Priority:** P3
- **Status:** Pending
- **Effort:** ~1h
- **Depends on:** Phase 3 (research integration exists)
- **Description:** Two quick improvements: (1) enforce explicit research links in phase template Context Links section, (2) create Claude Tasks for critical/high-risk steps within phases (not just phase-level tasks).

## Key Insights

- Current: step-03 tells agent to "cite research in Key Insights" but Context Links section doesn't mandate research file links. Easy to forget.
- Fix: phase-template.md should explicitly list `research/` links as required in Context Links when research reports exist.
- Current: step-05 creates 1 task per phase. ck-plan also creates tasks for high-risk steps within phases (e.g., "implement auth middleware" gets its own task within Phase 3).
- Fix: after phase-level tasks, scan for Todo items marked with `[HIGH]` or `[CRITICAL]` severity → create sub-tasks.

## Requirements

### Functional
1. **Context Links enforcement:** Update phase-template.md: if `{plan-dir}/research/` has reports, Context Links MUST include links to relevant reports
2. **Step-03 enforcement:** After writing phase files, verify each phase's Context Links references at least one research report (if research exists)
3. **Critical-step tasks in step-05:** After phase-level TaskCreate, scan each phase's Todo List for items with severity markers → create sub-tasks with `addBlockedBy` on parent phase task

### Non-Functional
- Zero extra token cost (enforcement is a check, not a subagent)
- Critical-step task creation adds ≤500 tokens (only for marked items)

## Architecture

### Research Link Enforcement

```
step-03 (draft plan):
  For each phase file:
    If research/ directory has reports:
      Check: does "## Context Links" contain at least one research/ link?
      If not: add link to most relevant report (by keyword matching)
```

### Critical-Step Task Pattern

```
step-05 (hydrate):
  For each phase task:
    Read phase file Todo List
    For each todo with [CRITICAL] or [HIGH] marker:
      TaskCreate(
        subject: "Phase {N} — {step description}",
        metadata: { step: true, critical: true, riskLevel: "high", phaseFile: "..." }
      )
      addBlockedBy: [parent phase task ID]
```

## Related Code Files

### Files to Modify
- `meowkit/.claude/skills/meow:plan-creator/references/phase-template.md` — Note research link requirement
- `meowkit/.claude/skills/meow:plan-creator/step-03-draft-plan.md` — Add research link verification
- `meowkit/.claude/skills/meow:plan-creator/step-05-hydrate-tasks.md` — Add critical-step task creation

## Implementation Steps

1. Update phase-template.md: add note under Context Links: "MUST include links to research reports if research/ exists"
2. Update step-03: after writing phase files, verify Context Links include research references
3. Update step-05: after phase tasks, scan for `[CRITICAL]`/`[HIGH]` markers in Todo Lists → create sub-tasks

## Todo List

- [ ] Update phase-template.md with research link requirement
- [ ] Add research link verification to step-03
- [ ] Add critical-step task creation to step-05
- [ ] Test: phase files link to research reports
- [ ] Test: critical steps get their own tasks

## Success Criteria

1. Phase files in hard mode always link to research reports in Context Links
2. Critical/high-risk Todo items get their own Claude Tasks
3. Zero extra overhead for phases without critical items

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Too many critical-step tasks | L | L | Only [CRITICAL]/[HIGH] markers; most todos are standard |
| Research link irrelevant | L | L | Keyword matching; agent can adjust |

## Security Considerations

N/A

## Next Steps

- Phase 5 (Documentation) is now the final phase — documents everything from 1-9
