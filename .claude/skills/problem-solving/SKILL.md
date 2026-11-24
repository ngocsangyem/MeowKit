---
name: mk:problem-solving
version: 1.0.0
description: "Unsticks a stalled approach. NOT for mk:investigate."
allowed-tools:
  - Read
  - Grep
  - Glob
source:
  - local
  - cc-thinking-skills
keywords:
  - problem-solving
  - first-principles
  - reasoning-framework
  - approach-design
  - decomposition
  - analytical-thinking
when_to_use: "Path keeps spiralling."
user-invocable: true
owner: research
criticality: medium
status: active
runtime: claude-code
---

# Problem-Solving — Strategic Unsticking

Seven techniques for being stuck on an approach, not on a cause. Each targets one failure mode of default thinking: match the symptom, load that one reference, apply it.

## When to use

| Stuck symptom | Technique | Reference |
| --- | --- | --- |
| Same thing implemented 5+ ways, growing special cases | Simplification Cascades: one insight eliminates several components | `references/simplification-cascades.md` |
| Conventional solutions inadequate, need a breakthrough | Collision-Zone Thinking: force unrelated domains together | `references/collision-zone-thinking.md` |
| Same issue across domains, reinventing wheels | Meta-Pattern Recognition: a pattern in 3+ domains is likely universal | `references/meta-pattern-recognition.md` |
| Solution feels forced, "must be done this way" | Inversion Exercise: flip the core assumption | `references/inversion-exercise.md` |
| "Should scale fine", with no idea where the limits are | Scale Game: test at 1000x bigger and smaller | `references/scale-game.md` |
| Told it is "impossible", or reasoning by analogy | First Principles: rebuild from verified basics | `references/first-principles.md` |
| Bloated system, removing beats adding | Via Negativa: improve by subtraction | `references/via-negativa.md` |
| Unsure which applies, or nothing worked | Fallback checks | `references/when-stuck.md` |

## Not this skill

| Situation | Use |
| --- | --- |
| Anything broken that needs fixing | `mk:fix` |
| Stuck on the cause of something (evidence-based diagnosis) | `mk:sequential-thinking` |
| Open solution exploration before a plan exists | `mk:brainstorming` |
| A known-options trade-off | `mk:party` or `mk:brainstorming` |
| Re-examining an existing output or verdict | `mk:elicit` |
| A trivial fix with an obvious cause | just do it |

## Process

1. Match the symptom to one technique (`references/when-stuck.md` for fallbacks).
2. Load that reference only.
3. Apply it, and keep a short log: technique, what it surfaced, decision or null result.
4. Combine only if the first pass fails: Simplification with Meta-Pattern, Collision with Inversion, Scale with Via Negativa, First Principles with Inversion.

## Gotchas

- **Tool-stacking**: running three techniques before finishing one. One at a time; finish or discard before adding.
- **Debugging misroute**: "my code is broken" is `mk:sequential-thinking` or `mk:fix`.
- **Premature abstraction**: collapsing two instances; the meta-pattern rule needs 3+ domains.
- **Metaphor over-fit** (collision): every metaphor breaks; document where.
- **Invalid inversion**: "trust all user input" is a security hole, not a context-dependent inversion. Test it: does it work in any real context?
- **Scale-game theater**: thinking about 1000x without the numbers; estimate concretely.
- **First-principles tourism**: listing assumptions without asking why each is assumed.
- **Via-negativa overkill**: removing something users rely on; confirm usage first.
- **Sunk-cost clinging**: refusing to accept that a technique gave nothing. Log the null result and move on.

Credit and licence: `references/attribution.md`.
