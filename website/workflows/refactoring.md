---
title: Refactoring
description: Safely refactor code with test coverage verification and architectural review.
persona: B
---

# Refactoring

> Improve code structure while guaranteeing nothing breaks.

**Best for:** Code improvement, tech debt reduction  
**Time estimate:** 15-45 minutes  
**Skills used:** [meow:cook](/reference/skills/cook), [meow:scout](/reference/skills/scout), [meow:review](/reference/skills/review)  
**Agents involved:** planner, tester, developer, reviewer, architect (if pattern changes)

## Overview

Refactoring with MeowKit follows the TDD refactor phase: existing tests must pass before AND after changes. The key difference from feature work is that **no new behavior is added** — tests should pass without modification.

## Step-by-step guide

### Step 1: Scout the code to understand current structure

```
/meow:scout payment module
```

The [meow:scout](/reference/skills/scout) skill spawns parallel Explore agents to map the module:
- File structure and dependencies
- Architecture fingerprint (patterns used)
- Complexity estimate (files × lines)
- Entry points

### Step 2: Plan the refactor

```
/meow:plan refactor payment module — extract service layer from controllers
```

The **planner** creates a plan. For refactoring, the plan focuses on:
- **What changes:** Which files move/split/rename
- **What doesn't change:** External API contracts, test behavior
- **Risk flags:** Files with many dependents, shared utilities

If the refactoring introduces new patterns (e.g., switching from MVC to service layer), the **architect** agent inserts to create an ADR documenting the decision.

### Step 3: Verify existing tests pass

The **tester** runs the full suite BEFORE any changes:

```
Tester: All 87 tests passing. This is our baseline.
        Any failure after refactoring indicates a regression.
```

### Step 4: Refactor with TDD safety net

The **developer** refactors following the plan. After each change:
- Tests run automatically
- Any regression immediately flagged
- Self-healing: developer adjusts approach (up to 3 attempts)

```
Developer: Moving payment logic to src/services/payment.service.ts
  Tests: 87/87 still passing ✓
Developer: Updating controllers to use service
  Tests: 85/87 passing ✗ — 2 integration tests need import update
  Self-heal attempt 1: Update test imports
  Tests: 87/87 passing ✓
```

### Step 5: Review focuses on architecture fit

The **reviewer** pays special attention to:
- **Architecture fit:** Does the refactoring improve or worsen the pattern?
- **No behavior changes:** Tests should pass WITHOUT modification
- **Performance:** No N+1 queries or unnecessary re-renders introduced

## What MeowKit prevents during refactoring

| Risk | How MeowKit prevents it |
|------|------------------------|
| Breaking existing behavior | TDD: tests must pass before AND after |
| Scope creep | Plan defines what changes and what doesn't |
| Unreviewed pattern changes | Architect reviews new patterns, creates ADR |
| Accidental security regression | `post-write.sh` scans every file write |

## Next workflow

→ [Writing Tests](/workflows/writing-tests) — add test coverage to untested code
