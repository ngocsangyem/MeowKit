---
name: "rule-anti-rationalization"
description: "rule-anti-rationalization"
---

# Anti-Rationalization (Shared)

Common rationalizations that appear at the start of non-trivial implementation work. When you catch yourself thinking one of these, the reality is the opposite. Read before any non-trivial implementation step (plan, code, refactor, fix).

## Table

| Thought                         | Reality                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| "This is too simple to plan"    | Simple tasks have hidden complexity. Plan takes 30 seconds.        |
| "I already know how to do this" | Knowing ≠ planning. Write it down.                                 |
| "Let me just start coding"      | Undisciplined action wastes tokens. Plan first.                    |
| "I'll plan as I go"             | That's not planning, that's hoping.                                |
| "Just this once"                | Every skip is "just this once." No exceptions.                     |

## Cross-References

- **Implementation-phase variants:** `.agents/skills/cook/SKILL.md` and `.agents/skills/cook/references/failure-catalog.md` (TDD-specific entries live there).
- **Exploration-phase variants:** `.agents/skills/brainstorming/references/anti-rationalization.md` (decomposition / discovery / anti-bias-pivot rationalizations are domain-specific to brainstorming).

## Applies To

- `mk:cook` — implementation pipeline (loads at Phase 1 entry)
- `mk:fix` — bug fixes
- `mk:plan-creator` — plan generation
- Any skill whose preamble warns against skipping plan / discipline steps