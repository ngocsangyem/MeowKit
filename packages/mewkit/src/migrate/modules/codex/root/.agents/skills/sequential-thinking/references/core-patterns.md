# Core Reasoning Patterns

> Part of mk:sequential-thinking.
> Source: open-source upstream (MIT)

## Revision Pattern

When new evidence invalidates a previous conclusion:

```
Hypothesis 2 [REVISION of Hypothesis 1]:
- Original: [what was stated]
- Why revised: [new evidence that contradicts]
- Impact: [what changes downstream]
```

**When to revise:**
- New evidence directly contradicts previous conclusion
- Scope turns out larger/smaller than estimated
- Initial approach proves inadequate
- Later insight changes interpretation of earlier findings

**Rule:** Revision is a sign of good reasoning, not failure. Never force-fit evidence to avoid revising.

## Branching Pattern

When multiple approaches are viable:

```
Hypothesis 3 [BRANCH A]: Approach using X
  - Pros: [list]
  - Cons: [list]

Hypothesis 3 [BRANCH B]: Approach using Y
  - Pros: [list]
  - Cons: [list]

[CONVERGENCE]: Branch [A/B] selected because [evidence-based reason]
```

**Limit:** Maximum 3 branches. Beyond 3 = problem not well-defined enough.

## Dynamic Adjustment

- **Expand** when: more complexity discovered, multiple aspects need investigation
- **Contract** when: key insight solves problem earlier than expected
- **Revise** when: new evidence invalidates previous conclusion

## Anti-Patterns

- **Premature completion**: concluding without testing all hypotheses → add verification step
- **Revision cascade**: one revision triggers chain of revisions → identify root cause of the cascade
- **Branch explosion**: too many branches → limit to 2-3, converge before adding more
- **Context loss**: forgetting earlier findings → reference previous hypotheses explicitly
