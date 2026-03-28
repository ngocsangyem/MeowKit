---
title: "meow:sequential-thinking"
description: "Structured step-by-step reasoning with hypothesis generation, elimination, revision, and deterministic thought tracking scripts."
---

# meow:sequential-thinking

Structured step-by-step reasoning with hypothesis generation, elimination, revision, and deterministic thought tracking.

## What This Skill Does

`meow:sequential-thinking` prevents the "guess root causes" anti-pattern. Instead of jumping to "I think it's X", it enforces evidence-based reasoning: generate hypotheses from observations, test each against evidence, eliminate until root cause is confirmed.

Called by `meow:fix` during diagnosis, but also useful standalone for complex architecture decisions or multi-step analysis.

## Core Capabilities

- **Hypothesis-driven investigation** — generate → test → eliminate → conclude
- **Evidence-based only** — every hypothesis needs verifiable evidence
- **Revision capability** — explicitly revise when new evidence contradicts
- **Branching** — explore 2-3 alternatives, converge with decision rationale
- **Structured output** — hypothesis table + elimination + root cause conclusion
- **Deterministic scripts** — `process-thought.js` tracks history/branches, `format-thought.js` outputs box/markdown/JSON
- **Advanced techniques** — spiral refinement, multi-branch convergence, progressive context deepening
- **Concrete examples** — debugging, API design, architecture decision walkthroughs

## When to Use This

::: tip Use meow:sequential-thinking when...

- Root cause isn't obvious (multiple possibilities)
- meow:fix invokes diagnosis phase
- Architecture decision with competing approaches
- Any "I think it's X" needs evidence before acting
  :::

## Scripts

| Script               | Purpose                                               | Usage                                                                               |
| -------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `process-thought.js` | Validate, track history, branches, revisions (max 20) | `node scripts/process-thought.js --thought "..." --number 1 --total 5 --next true`  |
| `format-thought.js`  | Format as box/simple/markdown/JSON                    | `node scripts/format-thought.js --thought "..." --number 1 --total 5 --format json` |
| `test-scripts.sh`    | 13-test suite for both scripts                        | `sh scripts/test-scripts.sh`                                                        |

The `--summary` flag on process-thought.js produces a context-efficient handoff for meow:fix.

## References

| Reference                  | When to load                                                   |
| -------------------------- | -------------------------------------------------------------- |
| `hypothesis-testing.md`    | Always — output template for diagnosis                         |
| `core-patterns.md`         | When using revision or branching                               |
| `advanced-techniques.md`   | Complex problems (spiral refinement, multi-branch convergence) |
| `advanced-strategies.md`   | Uncertainty or revision cascades                               |
| `examples-debug.md`        | Performance debugging walkthrough                              |
| `examples-api.md`          | API design reasoning                                           |
| `examples-architecture.md` | Architecture decision                                          |
| `gotchas.md`               | Common reasoning mistakes                                      |

::: info Skill Details
**Phase:** Called by meow:fix (Step 2 Diagnose). Also standalone.
:::

## Gotchas

- **Premature conclusion**: test minimum 2 hypotheses before concluding
- **Evidence-free hypotheses**: every hypothesis needs verifiable evidence
- **Confirmation bias**: actively search for evidence AGAINST each hypothesis

## Related

- [`meow:fix`](/reference/skills/fix) — Calls sequential-thinking during diagnosis
- [`meow:investigate`](/reference/skills/investigate) — Collects evidence that feeds into sequential-thinking
