---
name: meow:plan-creator
description: "Creates structured plan files before any implementation. Selects workflow model, validates completeness, enforces Gate 1. Activated by /meow:plan or /meow:cook commands."
---

# Plan Creator

## Trigger Conditions

Activate when:
- User runs `/meow:plan [feature]` or `/meow:cook [feature]`
- Any non-trivial task starts (> 30 min OR > 3 files affected)
- Gate 1 requires a plan before implementation proceeds

Skip when:
- `/meow:fix` with complexity=simple (Gate 1 exception per gate-rules.md)
- Task is < 3 files AND < 30 min AND no architectural decisions needed

## Step 1 — Select Workflow Model

Match task type to model before drafting anything:

| Task type | Model | File |
|-----------|-------|------|
| New functionality, endpoints, UI | feature-model | references/workflow-models/feature-model.md |
| Broken behavior, reported bug, failed test | bugfix-model | references/workflow-models/bugfix-model.md |
| Restructure without behavior change | refactor-model | references/workflow-models/refactor-model.md |
| Auth/payments, security review, audit | security-model | references/workflow-models/security-model.md |

Wrong model = wrong phase flow. Always confirm type before proceeding.

## Step 2 — Scope Assessment → Template Selection

```
< 5 files AND < 2 hours  →  plan-quick.md
5–15 files OR 2–8 hours  →  plan-template.md (single file)
> 15 files OR > 8 hours OR > 3 phases  →  plan-template.md + phase-XX-name.md per phase
```

Template: `assets/plan-template.md`

## Step 3 — Pre-Plan Research (if needed)

- **Unfamiliar codebase**: spawn `meow:scout` first → save to `reports/scout-report.md`
- **Unfamiliar tech/API**: spawn researcher subagents in parallel → save to `reports/researcher-NN-topic.md`
- Skip research only when codebase is well-known AND no new dependencies

## Step 4 — Draft Plan

Directory structure:
```
tasks/plans/YYMMDD-feature-name/
├── plan.md                    ← main plan (keep under 80 lines)
├── reports/
│   ├── scout-report.md
│   └── researcher-NN-topic.md
└── phase-XX-name.md           ← only if multi-phase
```

Date format: `YYMMDD` (e.g., `260327` for March 27, 2026). Name: kebab-case outcome-focused.

Fill in order: frontmatter → Goal (outcome, not activity) → Context → Scope → Constraints → Technical Approach → Acceptance Criteria → Agent State.

## Step 5 — Solution Options (when to use)

Generate multiple options ONLY when:
- Effort is m/l/xl AND multiple architecturally distinct approaches exist
- Trade-offs are non-obvious (not just "library A vs B")

Skip options when: effort xs/s, bug fix with confirmed root cause, single obvious approach.

Evaluate via: `references/solution-evaluation.md`

## Step 6 — Validate

Run before presenting for Gate 1:
```bash
python3 scripts/validate-plan.py tasks/plans/YYMMDD-name/plan.md
```

Must output `PLAN_COMPLETE`. Fix all reported issues before proceeding.

Manual checks:
- [ ] Goal is one sentence describing done-state, not activity
- [ ] Constraints section is non-empty
- [ ] Acceptance criteria use checkboxes, no subjective language
- [ ] Out of scope subsection exists
- [ ] Plan is self-contained (fresh session can pick it up)
- [ ] plan.md is under 80 lines (bulk content in reports/)

## Step 7 — Gate 1: Present for Human Approval

Print a summary:
```
PLAN READY FOR GATE 1
Title: [title]
Type: [type] | Model: [workflow model] | Effort: [xs/s/m/l/xl]
Goal: [one sentence]
Phases: [list]
Files affected: [count or list]
Validation: PLAN_COMPLETE

Approve to proceed to Phase 2 (Test RED). No code until approved.
```

Wait for explicit human approval. Do not infer approval from silence.

## Gotchas (top 3)

- **Wrong model for task type**: feature-model on a bug fix skips investigation → always confirm type first
- **Goal describes activity, not outcome**: "Implement OAuth" vs "Users can log in with OAuth" — next agent can't judge success → rewrite until Goal answers "what does done look like?"
- **Acceptance criteria that can't be verified**: "code is clean" blocks Gate 2 → every criterion must reference a specific command or file check

Full list: `references/gotchas.md`

## Handoff Protocol

After Gate 1 approval, update Agent State in plan.md:
```
Planning phase: approved
Last action: Gate 1 approved by [human]
Next action: tester writes failing tests (Phase 2)
Blockers: none
```

Hand off to tester agent with: plan file path + selected workflow model + acceptance criteria list.

## Plan Status Updates (resuming work)

1. Read plan.md — check Agent State section
2. Update completed/blocked phases
3. Mark todos: `- [x]`
4. NEVER leave items as in_progress at session end — mark Done, Blocked, or Cancelled

## References

- `assets/plan-template.md` — plan file template
- `references/workflow-models/` — feature, bugfix, refactor, security models
- `references/solution-evaluation.md` — trade-off scoring criteria
- `references/gotchas.md` — full gotchas list
- `references/scope-challenge.md` — scope modes (HOLD/EXPANSION/REDUCTION), complexity thresholds
- `references/research-phase.md` — scout + researcher subagent protocol
- `references/plan-organization.md` — directory structure, naming, size rules
- `references/output-standards.md` — YAML frontmatter, required sections, quality rules
- `references/task-management.md` — hydration, cross-session resume, sync-back
- `scripts/validate-plan.py` — plan completeness validator
- `tasks/templates/plan-quick.md` — quick plan template
- `tasks/templates/plan-phase.md` — phase file template
