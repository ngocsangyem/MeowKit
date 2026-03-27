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

1. **Scout (if needed)** — For unfamiliar codebases or large changes, spawn `meow:scout` to map relevant directories before planning. Save scout report to `tasks/plans/YYMMDD-name/reports/scout-report.md`.

2. **Research (if needed)** — For tasks involving unfamiliar tech, APIs, or architectural decisions, spawn researcher subagents. Save reports to `tasks/plans/YYMMDD-name/reports/researcher-NN-topic.md`. Multiple researchers can run in parallel on different topics.

3. **Select template** — Use the decision tree above. Read from `tasks/templates/`.

4. **Create plan directory with reports folder**:

   ```
   tasks/plans/YYMMDD-feature-name/
   ├── plan.md                          ← main plan
   ├── reports/                         ← scout + research reports
   │   ├── scout-report.md
   │   ├── researcher-01-topic.md
   │   └── researcher-02-topic.md
   └── phase-XX-name.md                 ← per phase (if multi-phase)
   ```

5. **Fill plan** — frontmatter + Goal + Context (informed by reports) + Phases + Constraints + Acceptance Criteria. Link to reports: `See reports/scout-report.md for codebase context.`

6. **Validate** — Run quality checklist below.

7. **Present for Gate 1** — Print summary, wait for human approval. No code until approved.

## Naming Convention

```
tasks/plans/YYMMDD-feature-name/
├── plan.md                            ← main plan (always)
├── reports/                           ← scout + research reports
│   ├── scout-report.md
│   └── researcher-NN-topic.md
├── phase-01-name.md                   ← per phase (if multi-phase)
└── phase-02-name.md
```

Always use directory format. Even simple plans benefit from `reports/` for research context.

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
