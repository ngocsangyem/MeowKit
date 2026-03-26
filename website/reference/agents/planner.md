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
/meow:plan add user authentication with JWT

# As part of the cook pipeline
/meow:cook add shopping cart  # → planner runs first automatically
```

The planner will:
1. Challenge your premises ("Do you really need JWT? Have you considered session-based auth?")
2. Apply both lenses
3. Produce a plan file
4. Wait for your approval (Gate 1)

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
