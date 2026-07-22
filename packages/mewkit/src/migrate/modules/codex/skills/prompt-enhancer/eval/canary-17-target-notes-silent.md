# Canary 17 — No target named → zero target notes (silent fallback)

**Mode:** default, and `--analyze` without a target
**Tier:** codebase-independent (pure text)
**Hard-fail dimensions:** No target block when none named

## Input

```
add a rate limiter to the /login endpoint
```

(Also run the same input with `--analyze` — still no target named.)

## Expected

### Default mode

- Emits ONLY the Section 4 Enhanced Prompt code block. No "Target-specific notes"
  block whatsoever.

### `--analyze` mode (no target)

- Sections 1–4 render. **No "Target-specific notes" block** — the input names no
  target, so `references/target-notes.md` does not fire.

### Rewritten Prompt

Universal kernel. Core ask ("add a rate limiter to the /login endpoint") verbatim.

### HARD-FAIL conditions (any one → block)

- A "Target-specific notes" block appears in default mode (should never).
- A "Target-specific notes" block appears in `--analyze` when no target is named.
- The skill guesses a vendor from ambiguous phrasing.

### Why this canary matters

Locks the silent-fallback rule: model-specific notes appear ONLY in `--analyze`
AND ONLY when the user explicitly names a target. Everything else stays
model-agnostic with nothing appended.
