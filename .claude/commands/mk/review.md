# /review — Phase 4: Structural Audit and Gate 2

## Usage

```
/review [optional: specific files or PR number]
```

## Behavior

Triggers Phase 4 structural audit. Runs the 5-dimension review using the `structural-audit` skill. Enforces Gate 2.

### Execution Steps

1. **Determine scope.** If specific files or a PR number are provided, review only those. Otherwise, review all staged/changed files since the last approved review.

2. **Run 5-dimension structural audit** using the `structural-audit` skill. Evaluate:

   | Dimension | What it checks |
   |-----------|---------------|
   | **Correctness** | Does the code do what the plan says? Logic errors, edge cases, off-by-ones. |
   | **Security** | Apply `rules/security-rules.md`. Check for blocked patterns. BLOCK-level findings fail this dimension. |
   | **Performance** | N+1 queries, unnecessary re-renders, missing indexes, unbounded loops, memory leaks. |
   | **Maintainability** | Naming conventions (per `rules/naming-rules.md`), code duplication, separation of concerns, readability. |
   | **Test Coverage** | Are new behaviors covered by tests? Do tests test the right things (behavior, not implementation)? |

3. **Generate verdict file.** Write to:
   ```
   tasks/reviews/YYMMDD-feature-name-verdict.md
   ```
   The verdict file contains per-dimension results (PASS/WARN/FAIL) with specific findings.

4. **Print summary.** Display a table:
   ```
   🐱 Review Results:
   ┌─────────────────┬────────┐
   │ Dimension       │ Result │
   ├─────────────────┼────────┤
   │ Correctness     │ PASS   │
   │ Security        │ PASS   │
   │ Performance     │ WARN   │
   │ Maintainability │ PASS   │
   │ Test Coverage   │ PASS   │
   └─────────────────┴────────┘
   ```

5. **Gate 2 enforcement.**
   - If any dimension is **FAIL**: block shipping. Print what must be fixed. Do not proceed.
   - If any dimension is **WARN**: list the warnings and ask the human to acknowledge each one.
   - If all dimensions **PASS**: request explicit human approval to proceed to shipping.

### Gate 2 Conditions (from gate-rules)

All must be true before proceeding to `/mk:ship`:
- Verdict file exists at `tasks/reviews/YYMMDD-name-verdict.md`
- No FAIL dimensions in the verdict
- All WARN items acknowledged by human
- Security scan shows no BLOCK items
- Human has explicitly typed approval

No exceptions. Every change ships through Gate 2.

### Output

A verdict file at `tasks/reviews/YYMMDD-feature-name-verdict.md` and a printed summary awaiting human approval.
