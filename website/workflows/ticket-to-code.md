---
title: Ticket to Code
description: Developer workflow from receiving a Jira ticket through understanding, planning, implementing, and shipping.
persona: B
---

# Ticket to Code

> You received a Jira ticket. Now what? Understand it, plan the work, implement, review, and ship.

**Best for:** Developers picking up tickets from sprint backlog
**Time estimate:** Varies by ticket complexity
**Skills used:** [mk:jira-issue](/reference/skills/jira-issue), [mk:jira-analyst](/reference/skills/jira-analyst), [mk:jira-evaluator](/reference/skills/jira-evaluator), [mk:jira-estimator](/reference/skills/jira-estimator), [mk:jira-lifecycle](/reference/skills/jira-lifecycle), [mk:jira-collaborate](/reference/skills/jira-collaborate), [mk:jira-relationships](/reference/skills/jira-relationships), [mk:planning-engine](/reference/skills/planning-engine), [mk:scout](/reference/skills/scout), [mk:plan-creator](/reference/skills/plan-creator), [mk:cook](/reference/skills/cook), [mk:review](/reference/skills/review), [mk:ship](/reference/skills/ship)

## Prerequisites

<!--@include: ./_jira-setup.md-->

## The Flow

```
Receive ticket → Understand → Plan → Implement → Review → Ship → Update ticket
```

Every step is a separate command. You decide when to move forward.

## Step-by-step

### Step 1: Understand the ticket

Read the ticket and assess what's needed:

```bash
# Read full ticket details (description, AC, comments, attachments, links)
/mk:jira-analyst AUTH-201

# Evaluate complexity (if not already done in sprint planning)
/mk:jira-evaluator AUTH-201

# Check story points / estimation
/mk:jira-estimator AUTH-201
```

**What you get:** Analysis report with gaps flagged, complexity assessment, story point suggestion.

**If the ticket is unclear:**
- Check `[MISSING]` and `[AMBIGUOUS]` flags in the evaluator output
- Ask the PO to clarify before proceeding
- Update the ticket: `/mk:jira-issue update AUTH-201 --set description="..."`

### Step 2: Review against codebase

Understand what code needs to change:

```bash
# Scout the codebase first
/mk:scout

# Tech review: ticket vs codebase
/mk:planning-engine review AUTH-201 --scout
```

**What you get:** Tech Review Report — affected files, feasibility rating, dependencies, risks, complexity signals.

**If the ticket is a bug:**

```bash
# Investigate the root cause (works on local codebase —
# paste the ticket description and repro steps when prompted)
/mk:investigate
```

Note: `mk:investigate` operates on your local codebase, not directly on Jira. Copy the bug description and reproduction steps from the analyst output into the investigation prompt.

### Step 3: Transition ticket

Move the ticket to "In Progress":

```bash
/mk:jira-lifecycle transition AUTH-201 "In Progress"
```

If the transition requires fields (e.g., resolution), `mk:jira-lifecycle` will prompt you.

**If the ticket is already in a terminal state** (Done, Deployed, Closed): you may need to reopen it first. Check available transitions — if none exist for "In Progress", ask your team lead about the reopen workflow.

### Step 4: Plan the implementation

```bash
# Create an implementation plan
/mk:plan-creator
```

This produces a plan with phases, file changes, and acceptance criteria. Gate 1 requires your approval before coding.

**For simple fixes:**

```bash
# Quick fix — skip the full planning cycle
/mk:fix AUTH-201
```

### Step 5: Implement

```bash
# Execute the plan
/mk:cook path/to/plan.md

# Or for a quick implementation
/mk:cook "Implement OAuth2 login per AUTH-201 requirements" --fast
```

### Step 6: Review

```bash
# Code review before shipping
/mk:review
```

Gate 2 — human approval required before shipping.

### Step 7: Ship

```bash
# Ship: merge main, test, commit, push, create PR
/mk:ship
```

### Step 8: Update ticket

After the PR is merged:

```bash
# Transition to Done
/mk:jira-lifecycle transition AUTH-201 "Done" --resolution Fixed

# Add a comment with what was done
/mk:jira-collaborate add-comment AUTH-201 "Implemented OAuth2 login. PR #42 merged."

# Link to related tickets if needed
/mk:jira-relationships link AUTH-201 relates-to AUTH-202
```

## By Ticket Type

### Bug Fix

```
/mk:jira-analyst BUG-456                          → understand the bug
/mk:jira-evaluator BUG-456                        → check for missing AC, gaps
/mk:jira-lifecycle transition BUG-456 "In Progress"
/mk:investigate                                    → find root cause (paste repro steps)
/mk:fix                                            → fix based on investigation
/mk:review                                         → code review
/mk:ship                                           → ship the fix
/mk:jira-lifecycle transition BUG-456 "Done" --resolution Fixed
```

### Feature (Story)

```
/mk:jira-analyst STORY-789                        → understand requirements
/mk:planning-engine review STORY-789 --scout      → tech review
/mk:jira-lifecycle transition STORY-789 "In Progress"
/mk:plan-creator                                   → implementation plan
/mk:cook plan.md                                   → implement
/mk:review                                         → code review
/mk:ship                                           → ship the feature
/mk:jira-lifecycle transition STORY-789 "Done" --resolution Fixed
```

### Technical Task

```
/mk:jira-analyst TASK-101                         → understand scope
/mk:jira-lifecycle transition TASK-101 "In Progress"
/mk:cook "Implement TASK-101" --fast              → quick implementation
/mk:review                                         → code review
/mk:ship                                           → ship
/mk:jira-lifecycle transition TASK-101 "Done" --resolution Done
```

## When Things Go Wrong

| Situation | What to do |
|---|---|
| Ticket AC is vague | `/mk:jira-evaluator` will flag `[MISSING]` — ask PO to clarify |
| Ticket is too large | `/mk:jira-evaluator` will flag Complex (8-13pt) — ask to split |
| Blocked by another ticket | `/mk:jira-relationships link AUTH-201 blocked-by AUTH-200` — work on something else |
| Implementation harder than expected | Update estimate: run `/mk:jira-estimator` again, share findings with team |
| Tests fail after implementation | `/mk:investigate` to find root cause, then `/mk:fix` |
| PR review finds issues | Fix issues, re-run `/mk:review`, then `/mk:ship` |

## Skill Graph

Common leaves you'll touch in this flow:

```
mk:jira-analyst       → ticket context (Step 1)
mk:jira-evaluator     → complexity check (Step 1)
mk:jira-estimator     → story points (Step 1)
mk:jira-lifecycle     → transitions + assignment (Steps 3, 8)
mk:jira-issue         → field updates (Step 1 clarifications)
mk:jira-collaborate   → progress / completion comments (Step 8)
mk:jira-relationships → blockers + related links (Step 8)

Power user — additional leaves available:
mk:jira-search        → find related issues by JQL
mk:jira-time          → log work
mk:jira-agile         → sprint / epic membership
mk:jira-dev           → branch-name + PR-description generation
```

See the [`mk:jira` reference](/reference/skills/jira) for the full leaf catalog.

## Related

- [Tickets to Sprint Planning](/workflows/spec-to-sprint) — upstream: how tickets get created
- [Ticket Evaluation & Estimation](/workflows/ticket-evaluation) — pre-planning assessment
- [Adding a Feature](/workflows/add-feature) — general feature workflow
- [Fixing a Bug](/workflows/fix-bug) — bug-specific investigation
- [Code Review](/workflows/code-review) — review workflow details
- [Shipping Code](/workflows/ship-code) — deploy pipeline details
