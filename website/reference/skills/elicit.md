---
title: "mk:elicit"
description: "Structured second-pass reasoning — re-examine review verdicts, plans, or analyses through named methods (pre-mortem, red team, Socratic)."
---

# mk:elicit

Re-examines existing outputs (review verdict, plan, analysis) through a named reasoning method. Surfaces insights that generic "make it better" requests miss.

## When to use

- After `/mk:review` verdict — deepen analysis before Gate 2
- After plan creation — stress-test assumptions before Gate 1
- After any agent output when user wants a specific angle
- "dig deeper", "what am I missing", "challenge this"

NOT for: initial review (use `mk:review`), creating plans (use `mk:plan-creator`), open exploration (use `mk:brainstorming`), or approach-stuck (use `mk:problem-solving`).

## Reasoning methods

| Method | Lens | Best for |
|---|---|---|
| Pre-mortem | "It failed. Why?" | Before major releases |
| Inversion | "What would make this worse?" | Optimizing for robustness |
| Red Team | Adversarial attack | Security-critical decisions |
| Socratic | Question assumptions | Entrenched beliefs |
| Steel Man | Best version of opposing view | Binary decisions |
| Five Whys | Root cause | Surface symptoms |
| Second-Order Effects | Downstream consequences | System changes |
| Devil's Advocate | Argue against consensus | Group decisions |

## Process

1. Identify the artifact to re-examine
2. Select method based on goal
3. Apply method — produce findings structured by the method's framework
4. Report findings appended to original artifact (never overwrite)
