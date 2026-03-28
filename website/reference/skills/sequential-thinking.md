---
title: "meow:sequential-thinking"
description: "Structured step-by-step reasoning with hypothesis generation, elimination, and revision for root cause analysis."
---

# meow:sequential-thinking

Structured step-by-step reasoning with hypothesis generation, elimination, and revision capability.

## What This Skill Does

`meow:sequential-thinking` prevents the "guess root causes" anti-pattern. Instead of jumping to "I think it's X", it enforces evidence-based reasoning: generate hypotheses from observations, test each against evidence, eliminate until root cause is confirmed.

Called by `meow:fix` during diagnosis, but also useful standalone for complex architecture decisions or multi-step analysis.

## Core Capabilities

- **Hypothesis-driven investigation** — generate → test → eliminate → conclude
- **Evidence-based only** — every hypothesis needs verifiable evidence
- **Revision capability** — explicitly revise when new evidence contradicts
- **Branching** — explore 2-3 alternatives, converge with decision rationale
- **Structured output** — hypothesis table + elimination + root cause conclusion

## When to Use This

::: tip Use meow:sequential-thinking when...
- Root cause isn't obvious (multiple possibilities)
- meow:fix invokes diagnosis phase
- Architecture decision with competing approaches
- Any "I think it's X" needs evidence before acting
:::

::: info Skill Details
**Phase:** Called by meow:fix (Step 2 Diagnose). Also standalone.
**Output:** Hypothesis table → root cause conclusion → fix scope
:::

## Gotchas

- **Premature conclusion**: test minimum 2 hypotheses before concluding
- **Evidence-free hypotheses**: every hypothesis needs verifiable evidence
- **Confirmation bias**: actively search for evidence AGAINST each hypothesis

## Related

- [`meow:fix`](/reference/skills/fix) — Calls sequential-thinking during diagnosis
- [`meow:investigate`](/reference/skills/investigate) — Collects evidence that feeds into sequential-thinking
