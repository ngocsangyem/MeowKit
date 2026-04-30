# Solution Evaluation Criteria

When comparing multiple solution options, evaluate against:

| Criterion | Weight | Question |
|-----------|--------|----------|
| Simplicity | High | Which approach has fewer moving parts? |
| Reversibility | High | Which is easier to undo if wrong? |
| Test coverage | Medium | Which is easier to test thoroughly? |
| Time to ship | Medium | Which ships faster to users? |
| Maintenance | Medium | Which is easier to maintain long-term? |
| Risk | High | Which has fewer unknowns? |

## Decision Rule
If one option scores higher on Simplicity + Reversibility + Risk, recommend it.
Tie-breaker: Time to ship.

## When to Skip Options
- Effort is xs or s (small tasks don't need trade-off analysis)
- Single obvious approach exists
- Bug fix with clear root cause
