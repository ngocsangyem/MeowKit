# mk:fix Gotchas

Common failure patterns when fixing bugs. Update this file when Claude produces wrong fix patterns.

## Anti-Patterns

### Guessing Root Causes
**Symptom:** "I think it's X" without evidence.
**Fix:** Use `mk:sequential-thinking` to generate + test hypotheses from evidence. Never guess.

### Fixing Symptoms
**Symptom:** Test passes but underlying issue remains.
**Fix:** Always trace backward: symptom → cause → ROOT cause. If you can't explain WHY it broke, you haven't found the root cause.

### Skipping Scout
**Symptom:** Fixing without codebase context → change breaks something else.
**Fix:** Mandatory scout maps what you're touching, its dependents, and recent changes.

### No Regression Test
**Symptom:** Bug resurfaces next sprint.
**Fix:** When behavior, security, or a public contract can regress, include a test that fails without the fix and passes with it. Lint-only, formatting-only, and configuration-only changes may omit it only with the rationale required by `SKILL.md` Step 5.

### Insanity Loop (3+ Failed Attempts)
**Symptom:** Same approach tried repeatedly with minor variations.
**Fix:** STOP after 3 failures. Question the architecture. Discuss with user.

### Over-Scoping the Fix
**Symptom:** "While I'm here, let me also refactor this..."
**Fix:** Fix ONLY the reported bug. Create a separate task for improvements.

### Ignoring Memory
**Symptom:** Same bug class fixed repeatedly.
**Fix:** Check `.meowkit/memory/fixes.json` only. Write new fix patterns by calling `Edit` directly on `.meowkit/memory/fixes.json` only (see SKILL.md Step 6 for the live schema). Do NOT use `##pattern:bug-class` — that is a user-typed keyboard shortcut; the handler only fires on `UserPromptSubmit` and agent output is invisible to it. See `.agents/skills/memory/references/capture-architecture.md`.

### Fixing Without Evidence
**Symptom:** "I think I know what's wrong" → fix deployed → bug persists.
**Fix:** Capture a deterministic reproducer or bounded intermittent evidence before fixing. If neither exists, gather more evidence instead of guessing.

### Changing Multiple Things at Once
**Symptom:** Fix touches 5 files, introduces new bug, can't tell which change caused it.
**Fix:** Change ONE thing, verify, then change the next. Isolate variables.
