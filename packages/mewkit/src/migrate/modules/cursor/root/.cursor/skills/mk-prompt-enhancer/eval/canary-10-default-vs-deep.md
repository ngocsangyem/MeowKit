# Canary 10 — default vs `--deep` convergence

**Mode:** both (run twice)
**Fixture:** caller-provided (see `eval/README.md` → "Deep-mode fixture")

## Input

Same prompt run twice:

Run A (default):
```
the prompt-enhancer skill "add caching to /api/products"
```

Run B (deep):
```
the prompt-enhancer skill --deep "add caching to /api/products"
```

## Expected

### Convergence rule

The two runs must produce IDENTICAL output for sections 1–3.
Section 4's universal kernel must be byte-identical.
Only differences allowed:

- Run B has the `[mode: deep]` tag (vs `[mode: default]` for Run A).
- Run B has a `### Suggested context (from --deep scout)` sub-block.
- Run B has a `> Deep-mode footer: ...` line at the end.

### Diff verification

```bash
diff <(extract-section "1-3" run-a.md) <(extract-section "1-3" run-b.md)
# → empty diff (PASS)

diff <(extract-section "4-kernel" run-a.md) <(extract-section "4-kernel" run-b.md)
# → empty diff (PASS)

diff run-a.md run-b.md
# → only the [mode] tag, sub-block, and footer (PASS)
```

### HARD-FAIL conditions

- Sections 1–3 differ between runs.
- Section 4 universal kernel differs (e.g., deep mode silently substituted
  `[FILL-IN]` placeholders with scout suggestions in the kernel itself rather
  than in the sub-block).
- Run B's `[FILL-IN]` brackets are missing — substitution must NEVER be auto.

### Why this canary matters

If `--deep` quietly mutates the rewritten prompt, the user can't trust the
default-mode output to be a clean baseline. The convergence rule preserves
the principle: `--deep` is **additive**, never **destructive**.
