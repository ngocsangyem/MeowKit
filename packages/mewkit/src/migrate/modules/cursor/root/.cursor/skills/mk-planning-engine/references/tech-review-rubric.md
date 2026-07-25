# Tech Review Rubric — Feasibility Assessment Criteria

Used by tech-analyzer agent. Qualitative assessment — NO point values.

## Feasibility Rating

| Rating | Criteria |
|--------|----------|
| **Straightforward** | Single module, clear requirements, existing patterns to follow, low risk |
| **Complex** | Cross-module, unclear requirements, new patterns needed, dependencies |
| **Needs Spike** | Unknown technology, no precedent, ambiguous scope, high risk |

## Assessment Dimensions

| Dimension | What to Evaluate | Signals |
|-----------|-----------------|---------|
| Scope clarity | Are requirements specific enough to implement? | Missing AC → lower confidence |
| Code surface area | How many files/modules does this touch? | >5 files → Complex |
| Dependency count | How many blocking/blocked-by relationships? | >3 deps → Complex |
| Migration risk | Does this change existing schemas, APIs, contracts? | Any migration → Complex |
| Test coverage | Does the affected area have existing tests? | <50% coverage → higher risk |
| External integration | New third-party APIs or services? | New external → Complex or Spike |
| Historical precedent | Were similar tickets done before? How long? | No precedent → lower confidence |

## Confidence Levels

| Level | When to Use |
|-------|-------------|
| **High** | Clear requirements, existing patterns, scout context available |
| **Medium** | Partial requirements, some unknowns, partial codebase context |
| **Low** | Vague requirements, no codebase context, no historical precedent |

## What This Rubric Does NOT Do

- Produce story point estimates (team estimates)
- Recommend implementation approaches (that's mk:plan-creator)
- Assess business value or priority (PO's domain)
