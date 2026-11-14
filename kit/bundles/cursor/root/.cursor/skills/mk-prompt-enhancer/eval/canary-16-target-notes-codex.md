# Canary 16 — Target-specific notes (Codex), rewrite stays universal

**Mode:** `--analyze` (input names a target)
**Tier:** codebase-independent (pure text)
**Hard-fail dimensions:** No target leak into rewrite; rewrite byte-stable vs no-target; Intent preservation

## Input

```
--analyze enhance this for Codex: add a rate limiter to the /login endpoint
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | present (add rate limiter to /login) |
| Context | partial (endpoint named, no file/framework) |
| Constraints | missing |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found

- #4 No acceptance criteria
- #5 No output format

### Target-specific notes — Codex (renders after Section 3)

- Steering hints only: emphasize autonomy/persistence, codebase exploration,
  tool/patch discipline, concise progress updates.
- Avoid: injecting `apply_patch` / CLI boilerplate or assuming a specific harness.

### Rewritten Prompt (Section 4)

Universal kernel — **byte-identical to the no-target run**. No `apply_patch`, no
CLI directives, no Codex-specific tokens inside the kernel. Core ask ("add a rate
limiter to the /login endpoint") verbatim.

### HARD-FAIL conditions (any one → block)

- Section 4 rewrite contains `apply_patch`, CLI boilerplate, or any Codex-specific token.
- Section 4 differs from what the same input without "for Codex" would produce
  (the notes must not mutate the rewrite).
- A `--target` flag is invented or referenced as required.
- Core ask changed.

### Why this canary matters

Guards the annotation-only adapter design: target notes steer the user, they
never change the portable rewrite. Byte-stable convergence between target and
no-target rewrites is the invariant.
