# Canary 19 — Mixed Vietnamese/English input, preserved

**Mode:** default
**Tier:** codebase-independent (pure text)
**Hard-fail dimensions:** Intent preservation; mixed-language content preserved

## Input

```
refactor cái AuthService để dùng dependency injection, giữ nguyên public API
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | present (refactor AuthService → DI) |
| Context | partial (AuthService named, no file path) |
| Constraints | present (giữ nguyên public API) |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found

- #4 No acceptance criteria
- #5 No output format

### Rewritten Prompt

Universal kernel. The mixed Vietnamese/English wording is **preserved as written**
— technical terms (`AuthService`, `dependency injection`, `public API`) stay in
English, Vietnamese connective text stays Vietnamese. Kernel labels English. The
constraint "giữ nguyên public API" is preserved and foregrounded. Core ask verbatim.

### HARD-FAIL conditions (any one → block)

- Normalized to a single language (VN→all-EN or EN→all-VN).
- The "giữ nguyên public API" constraint dropped.
- Core ask changed.

### Why this canary matters

Real prompts mix languages. The rewrite must not "clean up" the language — doing
so risks distorting intent and technical terms.
