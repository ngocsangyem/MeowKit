# Canary 21 — Mixed instructions/data → neutral fence, never XML

**Mode:** default
**Tier:** codebase-independent (pure text)
**Hard-fail dimensions:** Output is XML/vendor-delimiter free; data block unchanged

## Input

```
here is our config { "timeout": 5, "retries": 0, "baseUrl": "https://api.x" } update the timeout to 30s and add a retry policy of 3
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | present (update timeout, add retries) |
| Context | present (inline config data) |
| Constraints | missing |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found

- #4 No acceptance criteria
- #5 No output format
- #8 Mixed instructions/data — config dump and command share one line, no separator

### Improvement Suggestions

- Apply playbook #8: insert a **neutral fence** around the data:
  ```
  --- DATA START ---
  { "timeout": 5, "retries": 0, "baseUrl": "https://api.x" }
  --- DATA END ---
  ```
  Keep the instruction OUTSIDE the fence. Do NOT wrap the data in `<context>`
  tags or any vendor delimiter.

### Rewritten Prompt

Universal kernel. The config appears inside a `--- DATA START/END ---` fence; the
instruction ("update timeout to 30s, add retry policy of 3") sits outside it. The
data block content is unchanged. Core ask verbatim.

### HARD-FAIL conditions (any one → block)

- Output separates data using `<context>` (or any XML / vendor delimiter).
- The data block content is modified.
- Core ask changed.

### Why this canary matters

Regression guard for the playbook #8 de-coupling: the default data-separation fix
must be a model-neutral fence, never Codex's `<context>` idiom. Model-specific
delimiters belong in `--analyze` target-notes only.
