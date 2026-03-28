---
title: "meow:investigate"
description: "Systematic 5-phase debugging methodology with root cause investigation, pattern matching, and the Iron Law."
---

# meow:investigate

Systematic 5-phase debugging methodology with root cause investigation, pattern matching, and the Iron Law.

## What This Skill Does

`meow:investigate` enforces the most important debugging principle: **no fixes without root cause investigation first.** Instead of guessing at solutions, it walks through a structured methodology — collect symptoms, trace the code path, check git history for regressions, reproduce the bug, form a testable hypothesis, verify it, then fix. If three hypotheses fail, it stops and escalates rather than continuing to guess.

## Core Capabilities

- **Iron Law enforcement** — Blocks fixes until root cause is confirmed with evidence
- **5-phase methodology** — Collect → Trace → Analyze patterns → Test hypothesis → Verify fix
- **Pattern library** — Matches symptoms to known patterns: race condition, null propagation, state corruption, integration failure, config drift, stale cache
- **3-strike escalation** — After 3 failed hypotheses, stops and asks the user instead of guessing indefinitely
- **Scope locking** — Restricts edits to the affected module via `meow:freeze` to prevent scope creep
- **Blast radius check** — If fix touches >5 files, asks whether that's appropriate before proceeding

## When to Use This

::: tip Use meow:investigate when...
- You need to understand WHY something is broken, not just make it work
- Previous fix attempts haven't worked
- The bug is intermittent or hard to reproduce
- You suspect an architectural issue, not just a code bug
:::

## Usage

```bash
# Direct invocation
/meow:investigate login timeout after session expiry

# Usually invoked by meow:fix during its investigation phase
/meow:fix payment race condition  # → automatically uses investigate
```

## Example Prompts

| Prompt | Investigation approach |
|--------|----------------------|
| `session token not refreshing` | Trace auth middleware → check refresh logic → git log for recent changes |
| `intermittent test failures in CI` | Pattern: race condition → check shared state → timing dependencies |
| `works locally, fails in staging` | Pattern: config drift → compare env vars → check feature flags |
| `users see stale data after update` | Pattern: stale cache → check Redis TTL → CDN invalidation |

## Quick Workflow

```
Symptoms → Code Trace → Git History Check → Reproduce
  → Hypothesis: "Root cause is X because Y"
  → Verify with temporary log/assertion
  → Confirmed? → Fix + Regression Test
  → Not confirmed? → Back to investigation (max 3 tries)
  → 3 strikes? → Escalate to user
```

::: info Skill Details
**Phase:** 1–3  
**Plan-First Gate:** Produces input FOR plans — always skips gate.
:::

## Specialized Techniques (NEW)

Load based on bug type — progressive disclosure:

| Bug type | Reference | What it adds |
|----------|-----------|-------------|
| Deep stack trace | `root-cause-tracing.md` | Backward trace to ROOT CAUSE |
| Server/CI/DB | `system-investigation.md` | 5-step system methodology |
| Log correlation | `log-analysis.md` | Timeline + pattern matching |
| Performance | `performance-diagnostics.md` | Bottleneck isolation |
| Test pollution | `scripts/find-polluter.sh` | Bisection to find polluting test |

## Gotchas

- **Confirming hypothesis without disproving alternatives**: Finding evidence FOR a theory doesn't mean it's correct → Actively test at least one alternative hypothesis before concluding
- **Log timestamps in wrong timezone**: Server logs in UTC, local comparison in local time → Normalize all timestamps to UTC before correlation
- **Fixing where error appears**: Error at line 42 doesn't mean the bug is at line 42 → trace backward to source

## Related

- [`meow:fix`](/reference/skills/fix) — Orchestrates investigate within the fix pipeline
- [`meow:sequential-thinking`](/reference/skills/sequential-thinking) — Hypothesis-driven reasoning called during diagnosis
- [`meow:scout`](/reference/skills/scout) — Helps find relevant files during investigation
