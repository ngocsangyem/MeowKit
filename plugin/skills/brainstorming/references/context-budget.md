# Context Budget

Use when the run risks becoming broad, codebase-dependent, or handoff-heavy.

## Stage Budgets

| Stage | Budget |
|---|---|
| Discovery | Up to 3 questions per batch |
| Scout bridge | 3-6 bullets, max 10 file paths |
| Technique loading | 1 technique file per run |
| Idea generation | 3-8 ideas |
| Anti-bias pivot | 1 pivot |
| Challenge pass | 5 checks, 1 regeneration |
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
