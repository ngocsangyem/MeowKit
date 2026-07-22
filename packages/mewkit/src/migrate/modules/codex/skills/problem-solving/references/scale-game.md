# Scale Game

Test at extremes (1000× bigger / smaller, instant / year-long) to expose fundamental truths hidden at normal scales.

## Contents

- [Core Principle](#core-principle)
- [When to Use](#when-to-use)
- [Quick Reference](#quick-reference)
- [Process](#process)
- [Detailed Examples](#detailed-examples)
  - [Example 1: Error Handling](#example-1-error-handling)
  - [Example 2: Synchronous APIs](#example-2-synchronous-apis)
  - [Example 3: In-Memory State](#example-3-in-memory-state)
  - [Example 4: Single vs Million Users](#example-4-single-vs-million-users)
- [Both Directions Matter](#both-directions-matter)
- [Red Flags](#red-flags)
- [Success Metrics](#success-metrics)
- [Remember](#remember)


## Core Principle

**Extremes expose fundamentals.** What works at one scale fails at another.

## When to Use

| Symptom                               | Action                   |
| ------------------------------------- | ------------------------ |
| "Should scale fine" (without testing) | Test at extremes         |
| Uncertain about production behavior   | Scale up 1000×           |
| Edge cases unclear                    | Test minimum and maximum |
| Architecture validation needed        | Extreme testing          |

## Quick Reference

| Scale Dimension  | Test At Extremes            | What It Reveals                     |
| ---------------- | --------------------------- | ----------------------------------- |
| **Volume**       | 1 item vs 1B items          | Algorithmic complexity limits       |
| **Speed**        | Instant vs 1 year           | Async requirements, caching needs   |
| **Users**        | 1 user vs 1B users          | Concurrency issues, resource limits |
| **Duration**     | Milliseconds vs years       | Memory leaks, state growth          |
| **Failure rate** | Never fails vs always fails | Error handling adequacy             |

## Process

1. **Pick dimension** — what could vary extremely?
2. **Test minimum** — what if 1000× smaller / faster / fewer?
3. **Test maximum** — what if 1000× bigger / slower / more?
4. **Note what breaks** — where do limits appear?
5. **Note what survives** — what's fundamentally sound?
6. **Design for reality** — use insights to validate architecture.

## Detailed Examples

### Example 1: Error Handling

- **Normal scale:** "Handle errors when they occur" works fine
- **At 1B scale:** Error volume overwhelms logging, crashes system
- **Reveals:** Need to make errors impossible (type systems) or expect them (chaos engineering)
- **Action:** Design error handling for volume, not just occurrence

### Example 2: Synchronous APIs

- **Normal scale:** Direct function calls work, < 100ms latency
- **At global scale:** Network latency makes synchronous unusable (200–500ms)
- **Reveals:** Async / messaging becomes a survival requirement, not an optimization
- **Action:** Design async-first from the start

### Example 3: In-Memory State

- **Normal duration:** Works for hours / days in development
- **At years:** Memory grows unbounded, eventual crash
- **Reveals:** Need persistence or periodic cleanup, can't rely on memory forever
- **Action:** Design for stateless or externalized state

### Example 4: Single vs Million Users

- **Normal scale:** Session in memory works for 100 users
- **At 1M scale:** Memory exhausted, server crashes
- **Reveals:** Need distributed session store (Redis, database)
- **Action:** Design for horizontal scaling from the start

## Both Directions Matter

**Test smaller too:**

- What if only 1 user? Does complexity make sense?
- What if only 10 items? Is optimization premature?
- What if instant response? What becomes unnecessary?

Often reveals over-engineering or premature optimization.

## Red Flags

You need scale game when:

- "It works in dev" (but will it work in production?)
- No idea where limits are
- "Should scale fine" (without evidence)
- Surprised by production behavior
- Architecture feels arbitrary

## Success Metrics

After scale game, you should know:

- Where system breaks (exact limits)
- What survives (fundamentally sound parts)
- What needs redesign (scale-dependent)
- Production readiness (validated architecture)

## Remember

- Extremes reveal fundamentals hidden at normal scales
- What works at one scale fails at another
- Test BOTH directions (bigger AND smaller)
- Use insights to validate architecture early
- Don't guess — test at extremes

**Related:** Via Negativa (extremes reveal what to cut) · Simplification Cascades (what works at 1× and 1000× points to the real abstraction).