---
title: Adding a Feature
description: Build a feature from plan to PR using MeowKit's full pipeline.
persona: B
---

# Adding a Feature

> Plan, test, build, review, and ship a feature with MeowKit's full pipeline.

**Best for:** Active developers  
**Time estimate:** 15-60 minutes (depends on feature size)  
**Skills used:** [meow:cook](/reference/skills/cook), [meow:plan-creator](/reference/skills/plan-creator), [meow:review](/reference/skills/review), [meow:ship](/reference/skills/ship)

## Overview

This is the most common MeowKit workflow. You describe a feature, and MeowKit orchestrates the entire development pipeline — from planning through shipping — with specialist agents handling each phase.

## Step-by-step guide

### Step 1: Start the pipeline

```
/meow:cook add shopping cart with quantity management
```

The **orchestrator** classifies this as STANDARD complexity (feature, <5 files expected) and assigns Sonnet as the model tier.

### Step 2: Smart intent detection

The [meow:cook](/reference/skills/cook) skill detects your intent from the input:

| Your input | Detected mode | What happens |
|------------|--------------|--------------|
| Natural language task | Interactive (default) | Full pipeline with both gates |
| Path to existing plan | Plan execution | Skips planning, starts at Phase 2 |
| `--fast` flag | Fast mode | Skips Phase 1 planning |
| `--parallel` flag | Parallel mode | Spawns agents for independent components |

### Step 3: Planning (Phase 1)

The **planner** agent creates a plan file. For a shopping cart, it might produce:

```markdown
# Plan: Shopping Cart with Quantity Management

## Problem Statement
Users need to add products, adjust quantities, and proceed to checkout.

## Success Criteria
- [ ] Add/remove items from cart
- [ ] Adjust quantities (1-99)
- [ ] Cart persists across page navigation
- [ ] Cart total updates in real-time

## Technical Approach
- Pinia store for cart state (reactive, persisted)
- CartItem component with quantity controls
- Cart summary component with total calculation
```

**Gate 1:** Review the plan. Type `approve` to continue, or provide feedback.

### Step 4: Testing (Phase 2 — opt-in)

**TDD mode (`--tdd` / `MEOWKIT_TDD=1`):** The **tester** agent writes failing tests first:

```
Tester: "Writing tests for cart store and components..."
  ✓ tests/cart-store.test.ts — 8 tests (add, remove, quantity, total, persistence)
  ✓ tests/CartItem.test.ts — 5 tests (render, increment, decrement, remove, edge cases)
  All 13 tests verified FAILING (functionality not yet implemented)
  Ready for implementation.
```

The `pre-implement.sh` hook blocks the **developer** from writing code until these tests exist (in TDD mode).

**Default mode (TDD off):** Phase 2 is skipped — the developer goes directly to implementation. The tester may be invoked on-request (e.g., `/meow:test` after implementation) or for plan-coverage reasons. `pre-implement.sh` is a no-op.

### Step 5: Implementation (Phase 3)

The **developer** reads the plan and implements until tests pass:

```
Developer: "Reading plan... implementing cart store..."
  src/stores/use-cart-store.ts — Pinia setup store
  src/components/CartItem.vue — <script setup> component
  src/components/CartSummary.vue — total calculation
  Tests: 13/13 passing ✓
```

Every file write triggers `post-write.sh` which scans for security issues (hardcoded secrets, XSS, SQL injection).

### Step 6: Review (Phase 4)

The **reviewer** checks 5 dimensions:

```
Verdict: PASS WITH NOTES
  Architecture fit: PASS — uses existing Pinia store pattern
  Type safety: PASS — no any types, props typed with defineProps<T>
  Test coverage: PASS — 13 tests, all edge cases covered
  Security: PASS — no XSS, no localStorage for sensitive data
  Performance: NOTE — consider debouncing quantity updates

Suggestion: Debounce rapid quantity changes to reduce store updates
```

**Gate 2:** Review the verdict. Type `approve` to ship.

### Step 7: Ship (Phase 5)

The **shipper** runs the full ship pipeline:

```
✓ Pre-ship: tests pass, lint clean, types clean
✓ Commit: feat(cart): add shopping cart with quantity management
✓ Push: origin/feature/shopping-cart
✓ PR: https://github.com/org/repo/pull/45
```

### Step 8: Reflect (Phase 6)

The **documenter** updates project docs (adds cart section to README). The **analyst** routes learnings to the appropriate topic file (`review-patterns.json` for code patterns, `architecture-decisions.json` for design decisions — e.g., "cart feature: Pinia store pattern worked well, consider debounce for reactive controls").

## Common issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Plan too broad | Feature scope unclear | Narrow the description: "cart for product page" not just "cart" |
| Tests don't cover edge cases | Tester focused on happy path | Request: "include edge cases for 0 quantity and max quantity" |
| Developer self-heals 3 times then escalates | Test expectations don't match implementation approach | Check if plan needs revision or tests need updating |
| Review FAIL on security | Hardcoded values or unsafe patterns | Fix findings, re-review automatically |

## Next workflow

→ [Fixing a Bug](/workflows/fix-bug) — when something breaks after shipping
