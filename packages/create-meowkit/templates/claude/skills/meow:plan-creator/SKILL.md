---
name: meow:plan-creator
description: "Guides agents to create plans using the correct template. Auto-selects plan-quick.md vs plan-template.md based on task scope. Use when starting /meow:plan or /meow:cook commands."
---

# Plan Creator

## When to Use

Activate this skill when:
- User runs `/plan [feature]` or `/meow:cook [feature]`
- Agent needs to create a plan file before implementation (Gate 1)
- User explicitly asks to plan a task

## Template Selection

Assess the task scope BEFORE creating the plan:

```
Is the task a simple /meow:fix with complexity=simple?
├── YES → Skip plan (Gate 1 exception per gate-rules.md)
│
└── NO → Estimate scope:
    ├── < 5 files AND < 2 hours estimated
    │   └── Use plan-quick.md
    │       Template: tasks/templates/plan-quick.md
    │
    ├── 5-15 files OR 2-8 hours estimated
    │   └── Use plan-template.md (single file)
    │       Template: tasks/templates/plan-template.md
    │
    └── > 15 files OR > 8 hours OR > 3 phases
        └── Use plan-template.md + plan-phase.md per phase
            Templates: tasks/templates/plan-template.md
                       tasks/templates/plan-phase.md
            Structure: tasks/plans/YYMMDD-feature-name/
                       ├── plan.md (overview, copy from plan-template.md)
                       └── phase-XX-name.md (per phase)
```

## Plan Creation Steps

1. **Read the template**: Read the selected template file from `tasks/templates/`
2. **Fill frontmatter**: Set title, status=draft, priority, effort, created date, tags
3. **Set model_tier**: Match task complexity to Model Routing table in CLAUDE.md
4. **Write Goal**: One sentence — what success looks like
5. **Write Context**: Current state first, then problem (context before instructions)
6. **List Phases**: Break work into numbered phases with task checkboxes
7. **Write Constraints**: What MUST NOT change — prevents scope creep
8. **Write Acceptance Criteria**: Binary pass/fail conditions — measurable
9. **Save**: `tasks/plans/YYMMDD-feature-name.md`
10. **Present to human**: Print plan summary and wait for Gate 1 approval

## Naming Convention

```
tasks/plans/YYMMDD-feature-name.md          ← single-file plan
tasks/plans/YYMMDD-feature-name/            ← multi-phase plan directory
  ├── plan.md
  ├── phase-01-name.md
  └── phase-02-name.md
```

Date format: `YYMMDD` (e.g., `260326` for March 26, 2026)
Name: kebab-case, descriptive (e.g., `add-auth-middleware`, `fix-session-timeout`)

## Quality Checklist

Before presenting plan for Gate 1 approval:

- [ ] Goal is one clear sentence
- [ ] Context explains current state AND problem
- [ ] Every task has a file path
- [ ] Constraints section is not empty
- [ ] Acceptance criteria are binary (pass/fail), not subjective
- [ ] No content duplication — use links to docs/plans, not copies
- [ ] Plan is self-contained — a fresh session can pick it up without prior context

## Plan Status Updates

When resuming work on an existing plan:
1. Read the plan file
2. Check the Plan Status Log table
3. Update status of completed/blocked phases
4. Mark todos as done: `- [x]`
5. NEVER leave items as in_progress when finishing — mark Done, Blocked, or Cancelled

## Gotchas

- **Wrong template for scope**: Using plan-quick.md for a multi-phase project → Check: if > 5 files OR > 2 hours, use plan-template.md
- **Acceptance criteria too vague to verify**: "App works correctly" can't be tested → Every criterion must be independently verifiable by running a specific command or checking a specific file
