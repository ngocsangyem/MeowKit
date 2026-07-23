# Deep Mode

`--deep` is a planning mode for broad, high-risk work where an incomplete map will cost more than extra planning. It expands context gathering, but stays bounded and phase-scoped.

## Use When

- Major refactor or migration touches 5+ directories.
- Existing behavior spans APIs, jobs, schemas, UI, or shared contracts.
- Phase order depends on hidden dependencies.
- Cook would otherwise need to rediscover scope during implementation.

## Avoid When

- The task is a clear few-file change.
- The approach is still undecided. Route to `mk:brainstorming` first.
- The code location is unknown and the user has not named a feature area. Run `mk:scout` first.
- The work is a spike or throwaway prototype.

## Budget

- Scope scout: max 5 roots.
- Phase scout: max 3 scout calls per phase.
- Phase count: max 7.
- File inventory: max 12 rows per phase; summarize overflow.
- Do not run repository-wide scans.
- Do not recurse scout loops. One scope pass plus one phase pass is the limit.

## Pipeline

```text
scope challenge
  -> scope scout: roots, existing tests, contracts, uncertainty list
  -> draft phases from verified scope map
  -> phase scout: directories from phase files, bounded by budget
  -> compact deep appendix per phase
  -> semantic checks, verification, red-team, validation
```

## Phase Appendix

Add these subsections in each deep-mode phase after `## Related Code Files` or before `## Implementation Steps`:

```markdown
## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Modify | `src/foo.ts` | Existing entry point | Existing unit tests must still pass |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Current retry behavior | `tests/retry.test.ts` | Idempotency edge case | High |

### Interface Checklist

- `GET /api/foo` response shape must stay stable.
- `FooOptions.timeoutMs` remains optional.

### Dependency Map

- Phase 2 depends on Phase 1 migration.
- `src/foo.ts` imports `src/bar.ts`; update callers before deleting helpers.
```

## Context Rules

- Store raw scout reports under `research/`; phase files contain compact claims and links.
- Record uncertainty explicitly instead of expanding scans.
- Respect privacy hooks. Never inventory secrets or dotenv contents.
