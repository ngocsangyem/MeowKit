---
title: Ticket to Code
description: Developer workflow from receiving a Jira ticket through understanding, planning, implementing, and shipping.
persona: B
---

# Ticket to Code

> You received a Jira ticket. Now what? Understand it, plan the work, implement, review, and ship.

**Best for:** Developers picking up tickets from sprint backlog
**Time estimate:** Varies by ticket complexity
**Skills used:** [meow:jira](/reference/skills/jira), [meow:planning-engine](/reference/skills/planning-engine), [meow:scout](/reference/skills/scout), [meow:plan-creator](/reference/skills/plan-creator), [meow:cook](/reference/skills/cook), [meow:review](/reference/skills/review), [meow:ship](/reference/skills/ship)

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
/meow:jira analyze AUTH-201

# Evaluate complexity (if not already done in sprint planning)
/meow:jira evaluate AUTH-201

# Check story points / estimation
/meow:jira estimate AUTH-201
```

**What you get:** Analysis report with gaps flagged, complexity assessment, story point suggestion.

**If the ticket is unclear:**
- Check `[MISSING]` and `[AMBIGUOUS]` flags in the evaluation
- Ask the PO to clarify before proceeding
- Update the ticket: `/meow:jira update AUTH-201 --set description="..."`

### Step 2: Review against codebase

Understand what code needs to change:

```bash
# Scout the codebase first
/meow:scout

# Tech review: ticket vs codebase
/meow:planning-engine review AUTH-201 --scout
```

**What you get:** Tech Review Report — affected files, feasibility rating, dependencies, risks, complexity signals.

**If the ticket is a bug:**

```bash
# Investigate the root cause (works on local codebase — 
# paste the ticket description and repro steps when prompted)
/meow:investigate
```

Note: `meow:investigate` operates on your local codebase, not directly on Jira. Copy the bug description and reproduction steps from the ticket analysis into the investigation prompt.

### Step 3: Transition ticket

Move the ticket to "In Progress":

```bash
/meow:jira transition AUTH-201 "In Progress"
```

If the transition requires fields (e.g., resolution), meow:jira will prompt you.

**If the ticket is already in a terminal state** (Done, Deployed, Closed): you may need to reopen it first. Check available transitions — if none exist for "In Progress", ask your team lead about the reopen workflow.

### Step 4: Plan the implementation

```bash
# Create an implementation plan
/meow:plan-creator
```

This produces a plan with phases, file changes, and acceptance criteria. Gate 1 requires your approval before coding.

**For simple fixes:**

```bash
# Quick fix — skip the full planning cycle
/meow:fix AUTH-201
```

### Step 5: Implement

```bash
# Execute the plan
/meow:cook path/to/plan.md

# Or for a quick implementation
/meow:cook "Implement OAuth2 login per AUTH-201 requirements" --fast
```

### Step 6: Review

```bash
# Code review before shipping
/meow:review
```

Gate 2 — human approval required before shipping.

### Step 7: Ship

```bash
# Ship: merge main, test, commit, push, create PR
/meow:ship
```

### Step 8: Update ticket

After the PR is merged:

```bash
# Transition to Done
/meow:jira transition AUTH-201 "Done" --resolution Fixed

# Add a comment with what was done
/meow:jira add-comment AUTH-201 "Implemented OAuth2 login. PR #42 merged."

# Link to related tickets if needed
/meow:jira link AUTH-201 relates-to AUTH-202
```

## By Ticket Type

### Bug Fix

```
/meow:jira analyze BUG-456         → understand the bug
/meow:jira evaluate BUG-456        → check for missing AC, gaps
/meow:jira transition BUG-456 "In Progress"
/meow:investigate                   → find root cause (paste repro steps)
/meow:fix                           → fix based on investigation
/meow:review                        → code review
/meow:ship                          → ship the fix
/meow:jira transition BUG-456 "Done" --resolution Fixed
```

### Feature (Story)

```
/meow:jira analyze STORY-789        → understand requirements
/meow:planning-engine review STORY-789 --scout  → tech review
/meow:jira transition STORY-789 "In Progress"
/meow:plan-creator                   → implementation plan
/meow:cook plan.md                   → implement
/meow:review                        → code review
/meow:ship                          → ship the feature
/meow:jira transition STORY-789 "Done" --resolution Fixed
```

### Technical Task

```
/meow:jira analyze TASK-101          → understand scope
/meow:jira transition TASK-101 "In Progress"
/meow:cook "Implement TASK-101" --fast  → quick implementation
/meow:review                         → code review
/meow:ship                           → ship
/meow:jira transition TASK-101 "Done" --resolution Done
```

## When Things Go Wrong

| Situation | What to do |
|---|---|
| Ticket AC is vague | `/meow:jira evaluate` will flag `[MISSING]` — ask PO to clarify |
| Ticket is too large | `/meow:jira evaluate` will flag Complex (8-13pt) — ask to split |
| Blocked by another ticket | `/meow:jira link AUTH-201 blocked-by AUTH-200` — work on something else |
| Implementation harder than expected | Update estimate: run `/meow:jira estimate` again, share findings with team |
| Tests fail after implementation | `/meow:investigate` to find root cause, then `/meow:fix` |
| PR review finds issues | Fix issues, re-run `/meow:review`, then `/meow:ship` |

## Related

- [Spec to Sprint Planning](/workflows/spec-to-sprint) — upstream: how tickets get created
- [Ticket Evaluation & Estimation](/workflows/ticket-evaluation) — pre-planning assessment
- [Adding a Feature](/workflows/add-feature) — general feature workflow
- [Fixing a Bug](/workflows/fix-bug) — bug-specific investigation
- [Code Review](/workflows/code-review) — review workflow details
- [Shipping Code](/workflows/ship-code) — deploy pipeline details
