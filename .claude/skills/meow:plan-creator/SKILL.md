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

## Arguments

| Flag | Behavior | Context Reminder cook flag |
|------|----------|--------------------------|
| (default) | Full planning, Gate 1 | `/meow:cook [path]` |
| `--auto` | Auto complexity, design gate only | `/meow:cook --auto [path]` |
| `--fast` | Skip research, minimal plan | `/meow:cook --auto [path]` |
| `--hard` | Thorough, all gates | `/meow:cook [path]` |
| `--parallel` | File ownership matrix | `/meow:cook --parallel [path]` |

## Step 0 — Read Institutional Memory (mandatory)

Before planning, check for prior learnings:
1. Read `.claude/memory/lessons.md` if it exists — note patterns relevant to this task
2. Read `.claude/memory/patterns.json` if it exists — filter by scope:
   - Patterns with no `scope` field → apply everywhere (project-wide)
   - Patterns with `scope` → apply only if CWD is within that scope path
   - Check for frequency-tracked anti-patterns (type: "correction") first
3. If relevant learnings found, embed them in plan.md Context section as "Prior learnings"

Skip ONLY if memory/ directory doesn't exist. Never skip if it does.
Why: prevents re-solving known problems. 60 seconds reading saves hours.

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

## Step 3 — Discovery (skip if pre-researched)

**Skip if:** `tasks/reports/researcher-*.md` or `tasks/plans/*/reports/` already has findings, or `docs/design-guidelines.md` exists. Use existing reports as plan context.

**If needed:** Investigate architecture (meow:scout), existing patterns (Grep/Glob), constraints (docs/), external APIs (meow:docs-finder). Save to `reports/discovery.md`.

## Step 4 — Draft Plan

Output to `tasks/plans/YYMMDD-feature-name/plan.md` (≤80 lines). Use `assets/plan-template.md`.

Fill: frontmatter → Goal (outcome, not activity) → Context (Prior learnings) → Scope → Constraints → Technical Approach → Risk Map (m/l/xl effort) → Acceptance Criteria → Agent State.

Risk rules: codebase pattern → LOW | external dep/new API → HIGH | >5 files blast → HIGH | novel → MEDIUM+.

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

Load `references/gate-1-approval.md` and follow its exact process:
1. Print plan summary
2. Use AskUserQuestion (Approve / Modify / Reject)
3. On Approve → print Context Reminder with mode-matched `/meow:cook` command + absolute path
4. **STOP** — do not auto-proceed to Phase 2

## ADR Generation

When architecture decisions arise during planning, load `references/adr-generation.md`.
Output: `docs/architecture/NNNN-title.md` (sequence-numbered).
Use when: schema changes, new API boundaries, auth/payment architecture, technology choices.

## Gotchas (top 3)

- **Wrong model for task type**: feature-model on a bug fix skips investigation → always confirm type first
- **Goal describes activity, not outcome**: "Implement OAuth" vs "Users can log in with OAuth" — next agent can't judge success → rewrite until Goal answers "what does done look like?"
- **Acceptance criteria that can't be verified**: "code is clean" blocks Gate 2 → every criterion must reference a specific command or file check

Full list: `references/gotchas.md`

## Handoff Protocol

After Gate 1 approval, update Agent State: `Planning phase: approved`. Hand off to tester with: plan path + workflow model + acceptance criteria.

When resuming: read plan.md Agent State → update completed/blocked → mark todos. Never leave items in_progress at session end.

## References

- `assets/plan-template.md` — plan file template
- `references/workflow-models/` — feature, bugfix, refactor, security models
- `references/solution-evaluation.md` — trade-off scoring criteria
- `references/gotchas.md` — full gotchas list
- `references/scope-challenge.md` — scope modes (HOLD/EXPANSION/REDUCTION), complexity thresholds
- `references/research-phase.md` — scout + researcher subagent protocol
- `references/plan-organization.md` — directory structure, naming, size rules
- `references/output-standards.md` — YAML frontmatter, required sections, quality rules
- `references/gate-1-approval.md` — AskUserQuestion gate + Context Reminder + Print & Stop
- `references/task-management.md` — hydration, cross-session resume, sync-back
- `scripts/validate-plan.py` — plan completeness validator
- `tasks/templates/plan-quick.md` — quick plan template
- `tasks/templates/plan-phase.md` — phase file template
