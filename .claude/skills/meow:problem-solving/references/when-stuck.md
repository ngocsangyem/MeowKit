# When Stuck — Dispatch

Different stuck-types need different techniques. Match symptom → technique. One at a time.

## Flowchart

```
YOU'RE STUCK
│
├─ Code broken? Wrong behavior? Test failing?
│  └─→ NOT HERE — route to meow:sequential-thinking (evidence-based diagnosis)
│
├─ Same thing implemented 5+ ways? Growing special cases?
│  └─→ Simplification Cascades
│
├─ Conventional solutions inadequate? Need breakthrough?
│  └─→ Collision-Zone Thinking
│
├─ Same issue different places? Reinventing wheels? Déjà vu?
│  └─→ Meta-Pattern Recognition
│
├─ Solution feels forced? "Must be done this way"? Stuck on assumption?
│  └─→ Inversion Exercise
│
├─ "Will this work in prod?" Edge cases unclear? Unsure of limits?
│  └─→ Scale Game
│
├─ Told it's "impossible" / "too expensive"? Reasoning by analogy?
│  └─→ First Principles
│
└─ Bloated system? "Just add one more feature"? Too much ceremony?
   └─→ Via Negativa
```

## Symptom → Technique

| How stuck             | Details                                      | Technique                  |
| --------------------- | -------------------------------------------- | -------------------------- |
| Complexity spiraling  | Same concept 5+ ways, excessive if/else      | simplification-cascades    |
| Innovation block      | Conventional inadequate, breakthrough needed | collision-zone-thinking    |
| Recurring patterns    | Same shape elsewhere, wheels reinvented      | meta-pattern-recognition   |
| Forced by assumption  | "Must be this way", can't question premise   | inversion-exercise         |
| Scale uncertainty     | Edge cases unclear, prod behavior unknown    | scale-game                 |
| Told "impossible"     | Industry convention as justification         | first-principles           |
| Bloat / addition bias | Instinct to add, should be subtracting       | via-negativa               |
| Code broken           | Wrong output, failing test                   | → meow:sequential-thinking |

## Process

1. Identify stuck-type.
2. Load that one reference.
3. Apply its process.
4. Document attempt (worked / failed / null result).
5. If still stuck — try a combination or reroute.

## Combining (only if one pass fails)

- Simplification + Meta-pattern — find pattern, collapse all instances.
- Collision + Inversion — force metaphor, invert its assumptions.
- Scale + Via Negativa — extremes reveal what to cut.
- First Principles + Inversion — rebuild from zero, then flip the rebuild.

## If Nothing Works

Fallback checks, in order:

1. **Reframe** — am I solving the right problem?
2. **Explain to someone else** — rubber-duck reveals hidden assumptions.
3. **Simplify scope** — smaller version first.
4. **Question constraints** — real or assumed?
5. **Reroute** — if the block is "not enough evidence about cause," switch to `meow:sequential-thinking`. If it's a multi-perspective trade-off, switch to `meow:party`.

## Remember

- One technique at a time. Stacking hides which one helped.
- Null results are useful. Log them.
- Not stuck forever — just temporarily.
