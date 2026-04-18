# meow:fix Gotchas

Common failure patterns when fixing bugs. Update this file when Claude produces wrong fix patterns.

## Anti-Patterns

### Guessing Root Causes
**Symptom:** "I think it's X" without evidence.
**Fix:** Use `meow:sequential-thinking` to generate + test hypotheses from evidence. Never guess.

### Fixing Symptoms
**Symptom:** Test passes but underlying issue remains.
**Fix:** Always trace backward: symptom → cause → ROOT cause. If you can't explain WHY it broke, you haven't found the root cause.

### Skipping Scout
**Symptom:** Fixing without codebase context → change breaks something else.
**Fix:** Mandatory scout maps what you're touching, its dependents, and recent changes.

### No Regression Test
**Symptom:** Bug resurfaces next sprint.
**Fix:** Every fix includes a test that fails without the fix and passes with it.

### Insanity Loop (3+ Failed Attempts)
**Symptom:** Same approach tried repeatedly with minor variations.
**Fix:** STOP after 3 failures. Question the architecture. Discuss with user.

### Over-Scoping the Fix
**Symptom:** "While I'm here, let me also refactor this..."
**Fix:** Fix ONLY the reported bug. Create a separate task for improvements.

### Ignoring Memory
**Symptom:** Same bug class fixed repeatedly.
**Fix:** Check `.claude/memory/fixes.json` (structured) or `.claude/memory/fixes.md` (narrative) for prior bug-class fixes before starting. Write new fix patterns via `##pattern:bug-class ...` to route into `fixes.json`.

### Fixing Without Reproducing First
**Symptom:** "I think I know what's wrong" → fix deployed → bug persists.
**Fix:** Always reproduce the bug before fixing. If you can't reproduce it, you don't understand it.

### Changing Multiple Things at Once
**Symptom:** Fix touches 5 files, introduces new bug, can't tell which change caused it.
**Fix:** Change ONE thing, verify, then change the next. Isolate variables.

