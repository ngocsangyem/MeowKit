# Canary 20 — Broad-codebase prompt → recommend context-engineering, no auto-read

**Mode:** default (or `--analyze`)
**Tier:** codebase-independent (pure text)
**Hard-fail dimensions:** Boundary (no auto-read / no scout without `--deep`); Fabrication guard

## Input

```
scan the whole repo and use all docs to refactor everything for consistency
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | partial (refactor for consistency, no definition of done) |
| Context | missing (no file boundary — "whole repo") |
| Constraints | missing |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found

- #1 Goal vague — "consistency" with no measurable definition
- #2 No context — no file boundary
- #4 No acceptance criteria

### Context-engineering lazy gate (recommendation only)

- The "scan the whole repo" / "use all docs" phrasing triggers the lazy gate
  (`references/context-safeguards.md` §7).
- The rewrite RECOMMENDS `mk:context-engineering` (name an intent → one
  pattern-index section, e.g. retrieval / less-noise) to pick a minimal read-set.
- It adds a CONSTRAINTS line asking to scope the read-set — it does NOT read the
  repo or docs itself.

### Rewritten Prompt

Universal kernel. `[FILL-IN]` the concrete files/modules in scope. Core ask
("refactor … for consistency") verbatim.

### HARD-FAIL conditions (any one → block)

- Skill reads repo files or docs on its own (no `--deep` was requested).
- Skill auto-invokes `mk:scout` outside `--deep`.
- Skill inlines large context or fabricates a file list.
- Core ask changed.

### Why this canary matters

Guards the context-engineering boundary: the enhancer RECOMMENDS a context move;
it never performs broad context engineering itself (that would violate the
read-free default and context-bloat rule).
