---
title: planner
description: "Product and engineering planning agent with two-lens review that produces structured plans and enforces Gate 1."
---

# planner

Product and engineering planning agent with two-lens review that produces structured plans and enforces Gate 1.

## Overview

The planner creates structured implementation plans before any code is written. It applies two lenses: a **product lens** (is this the right thing to build?) and an **engineering lens** (is this the right way to build it?). The output is a plan file at `tasks/plans/YYMMDD-name.md` that must be approved by a human before implementation begins (Gate 1).

The planner challenges your assumptions, evaluates alternatives, estimates effort, and flags risks — all before a single line of code is touched.

## Quick Reference

### Plan File Structure

Every plan MUST include these six sections:

| Section | Purpose |
|---------|---------|
| **Problem Statement** | What problem this solves and for whom |
| **Success Criteria** | Measurable definition of done |
| **Out of Scope** | What this plan explicitly does NOT cover |
| **Technical Approach** | How it will be built (architecture, components, data flow) |
| **Risk Flags** | What could go wrong and mitigation strategies |
| **Estimated Effort** | Time estimate for both human team and MeowKit |

### Two-Lens Evaluation

| Lens | Questions asked |
|------|----------------|
| **Product** | Is this the right thing to build? Are assumptions validated? Does the user really need this? |
| **Engineering** | Is the approach sound? Are there simpler alternatives? What are the tradeoffs? |

## How to Use

```bash
# Explicit invocation
/mk:plan add user authentication with JWT

# As part of the cook pipeline
/mk:cook add shopping cart  # → planner runs first automatically
```

The planner will:
1. Challenge your premises ("Do you really need JWT? Have you considered session-based auth?")
2. Apply both lenses
3. Produce a plan file
4. Wait for your approval (Gate 1)

## Bead Decomposition

For COMPLEX tasks (touching 5+ files), the planner applies **bead decomposition** before finalizing the plan. Each bead is an atomic, independently committable unit of work.

### What is a bead?

A bead is a self-contained slice of the implementation that:
- Touches a bounded set of files (typically 1-3)
- Can be committed and verified independently
- Has a clear done state (tests pass, type-check passes)
- Can be resumed if the agent session is interrupted

### How it works

```
COMPLEX task → planner decomposes into N beads
Each bead:  [files] + [acceptance check] + [commit message]
Sequence:   bead-01 → commit → bead-02 → commit → ...
```

The plan file lists beads as numbered sections. The developer processes them sequentially and commits after each. If the session is interrupted mid-task, the developer resumes from the last uncommitted bead — not from scratch.

### When to use

| Task scope | Approach |
|-----------|---------|
| < 5 files | Standard plan — no bead decomposition |
| 5+ files (COMPLEX) | Bead decomposition required |
| Parallel subtasks | Beads per agent, worktree isolation |

### validate-plan integration

For COMPLEX tasks, the planner runs `mk:validate-plan` after producing the plan file and before presenting Gate 1. This skill checks 8 quality dimensions:

1. Problem statement clarity
2. Success criteria are binary (pass/fail, not subjective)
3. Out-of-scope items explicitly listed
4. Technical approach matches codebase patterns
5. Risk flags are actionable (not vague)
6. Bead boundaries are clean (no circular dependencies)
7. Effort estimate is realistic
8. Acceptance criteria map to testable behaviors

A plan that fails `validate-plan` is revised before Gate 1 is presented to the human. The human never sees a plan that hasn't passed the 8-dimension check.

## Under the Hood

### Handoff Example

**Planner receives from orchestrator:**
```
Task: "Add user authentication with JWT"
Complexity: COMPLEX
Sequence position: Phase 1
```

**Planner produces:**
```
File: tasks/plans/260327-auth-jwt.md
Status: AWAITING APPROVAL (Gate 1)
Handoff to: architect (if architectural decisions needed), then tester (Phase 2)
Risk flags: 2 (session management complexity, token refresh edge cases)
```

**After human approves:** Pipeline continues to tester (or architect first if flagged).

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Plan rejected by user | Scope too broad or wrong approach | Ask planner to narrow scope or explore alternatives |
| Planner asks too many questions | Task is genuinely ambiguous | Provide more context: target users, constraints, existing patterns |
| Plan missing sections | Shouldn't happen (enforced) | Report — all 6 sections are mandatory |
| Can't proceed past Gate 1 | Plan not yet approved | Review and type "approve" to continue |
