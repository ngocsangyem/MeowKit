# Context Budget

Use when the run risks becoming broad, codebase-dependent, or handoff-heavy.

## Stage Budgets

| Stage | Budget |
|---|---|
| Discovery (deep only) | Up to 3 focused questions per batch |
| Scout bridge | 3-6 bullets, max 10 file paths |
| Technique loading | 1 technique file per run |
| Idea generation (deep only) | 3-8 ideas, never more than 8 |
| Anti-bias pivot (deep only) | 1 pivot |
| Challenge pass (deep only) | 5 checks, 1 regeneration |
| Rejected alternatives | Keep only those needed to explain the recommendation |
| Handoff packet | 10 fields plus report path |

## Scout Bridge

Use scout when the solution depends on current modules, public contracts, data models, or deployment constraints.

Skip scout when the problem is conceptual, green-field enough, or already includes sufficient touchpoint context.

Scout summary shape:

```text
- Relevant files: [max 10 paths]
- Current pattern: [1-2 bullets]
- Constraints/contracts: [1-2 bullets]
- Unknowns that affect approach choice: [optional]
```

Never include secrets, raw logs, full transcripts, or sensitive file contents.

Quick runs do not load this reference: state a material assumption and return 2-4 inline options instead of running discovery or scout.
