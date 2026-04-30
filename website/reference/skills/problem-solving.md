---
title: "mk:problem-solving"
description: "Strategic unsticking via 7 non-default techniques for approach-level stuck-moments: simplification cascades, collision-zone thinking, meta-pattern recognition, inversion, scale game, first principles, via negativa."
---

# mk:problem-solving

Seven non-default techniques for when you're stuck on *approach*, not on *cause*.

## What This Skill Does

`mk:problem-solving` targets the stuck-moments where default thinking fails — complexity spirals, innovation blocks, forced assumptions, scale uncertainty, "told it's impossible," and bloated systems needing subtraction. Each technique is a specific mental shift with a crisp trigger symptom.

Distinct from `mk:sequential-thinking` (which is for evidence-based root-cause debugging). Problem-solving is for being stuck on *approach*; sequential-thinking is for being stuck on *cause*.

## Core Capabilities

- **Symptom-based dispatch** — 8-row table routes stuck-symptoms to the right technique; no guessing
- **Seven techniques** — Simplification Cascades, Collision-Zone Thinking, Meta-Pattern Recognition, Inversion Exercise, Scale Game, First Principles, Via Negativa
- **Explicit boundary** — description and dispatch table reroute debugging requests to `mk:sequential-thinking`
- **Progressive disclosure** — SKILL.md is a router; references/ loads on demand (one technique at a time)
- **Gotchas section** — 9 named failure modes (tool-stacking, premature abstraction, invalid inversion, scale-game theater, first-principles tourism, etc.)
- **Composable** — 4 documented technique-combinations for when one pass isn't enough

## When to Use This

::: tip Use mk:problem-solving when...

- Same concept implemented 5+ ways; growing special cases
- Conventional solutions feel incremental; need breakthrough
- Same issue reappears across domains (reinventing wheels)
- Solution feels forced; "must be this way" thinking
- "Should scale fine" — no idea where limits actually are
- Told it's "impossible" or "too expensive"
- System is bloated; instinct is to add but removing is the fix
  :::

::: warning Do NOT use for

- Root-cause debugging → use `mk:sequential-thinking` (evidence-based hypothesis testing)
- Trivial fixes (typo, rename, single-file with obvious cause)
- Known-options trade-off → use `mk:party` (multi-agent) or `mk:brainstorming`
  :::

## The Seven Techniques

| Technique | Red Flag (trigger phrase) | Win Shape |
|---|---|---|
| Simplification Cascades | "Just need to add one more case..." | 10× (things deleted), not 10% |
| Collision-Zone Thinking | "I've tried everything in this domain" | Emergent properties from metaphor |
| Meta-Pattern Recognition | "This problem is unique" | Pattern appears in 3+ domains → universal |
| Inversion Exercise | "There's only one way to do this" | Valid inversion reveals context-dependence |
| Scale Game | "Should scale fine" without evidence | Production readiness validated before production |
| First Principles | Everyone accepts a constraint without evidence | Rebuild from fundamentals; escape analogy |
| Via Negativa | "Adding X to fix problem caused by adding Y" | Remove to surface the real issue |

## References

| Reference | When to load |
|---|---|
| `when-stuck.md` | Start here if symptom unclear — dispatch flowchart |
| `simplification-cascades.md` | Complexity spirals, growing special cases |
| `collision-zone-thinking.md` | Need breakthrough; conventional inadequate |
| `meta-pattern-recognition.md` | Same shape across 3+ places; reinventing wheels |
| `inversion-exercise.md` | Solution feels forced; "must be" thinking |
| `scale-game.md` | Production behavior unclear; edge cases unknown |
| `first-principles.md` | Told "impossible"; reasoning by analogy |
| `via-negativa.md` | Bloated; addition-bias; subtraction is the fix |
| `attribution.md` | Source lineage (claudekit / amplifier / cc-thinking-skills) |

::: info Skill Details
**Phase:** Cross-cutting. Triggers during planning or implementation when stuck on approach.
:::

## Gotchas

- **Tool-stacking** — running 3 techniques at once hides which one helped. One at a time.
- **Debugging misroute** — "my code is broken" is not problem-solving territory. Route to `mk:sequential-thinking`.
- **Premature abstraction** — collapsing 2 instances. Meta-pattern rule requires 3+ domains.
- **Invalid inversion** — "trust all user input" is a security hole, not a valid inversion.
- **Scale-game theater** — thinking about 1000× without running the numbers.
- **First-principles tourism** — listing assumptions ≠ challenging them. Must ask *why* each is assumed.

## Related

- [`mk:sequential-thinking`](/reference/skills/sequential-thinking) — Evidence-based root-cause diagnosis (distinct axis)
- [`mk:brainstorming`](/reference/skills/brainstorming) — Exploring known-alternative trade-offs
- [`mk:party`](/reference/skills/party) — Multi-agent deliberation for architectural decisions
- [`mk:investigate`](/reference/skills/investigate) — 5-phase debugging (upstream of sequential-thinking)
