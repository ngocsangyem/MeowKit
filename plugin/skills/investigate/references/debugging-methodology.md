<!-- Extracted from SKILL.md for progressive disclosure (checklist #11, #14) -->
<!-- The actual debugging methodology — loaded when investigation begins -->

# Systematic Debugging Methodology

## Iron Law

**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.**

Fixing symptoms creates whack-a-mole debugging. Find the root cause, then fix it.

---

## Phase 1: Root Cause Investigation

1. **Collect symptoms:** Read error messages, stack traces, reproduction steps. Ask ONE question at a time via AskUserQuestion if context is missing.
2. **Read the code:** Trace the code path from symptom back to potential causes. Use Grep to find all references, Read to understand logic.
3. **Check recent changes:** `git log --oneline -20 -- <affected-files>` — regression means root cause is in the diff.
4. **Reproduce:** Can you trigger the bug deterministically? If not, gather more evidence.

Output: **"Root cause hypothesis: ..."** — a specific, testable claim.

## Scope Lock

After forming hypothesis, lock edits to the affected module:
```bash
[ -x "${CLAUDE_SKILL_DIR}/../freeze/bin/check-freeze.sh" ] && echo "FREEZE_AVAILABLE" || echo "FREEZE_UNAVAILABLE"
```
If available: write the narrowest directory to `$STATE_DIR/freeze-dir.txt`. Tell user edits are restricted.

## Phase 2: Pattern Analysis

| Pattern | Signature | Where to look |
|---------|-----------|---------------|
| Race condition | Intermittent, timing-dependent | Concurrent access to shared state |
| Nil/null propagation | NoMethodError, TypeError | Missing guards on optional values |
| State corruption | Inconsistent data, partial updates | Transactions, callbacks, hooks |
| Integration failure | Timeout, unexpected response | External API calls, service boundaries |
| Configuration drift | Works locally, fails in staging/prod | Env vars, feature flags, DB state |
| Stale cache | Shows old data, fixes on cache clear | Redis, CDN, browser cache, Turbo |

Also check `TODOS.md` and `git log` for prior fixes in same area.

**External search:** If bug doesn't match known patterns, WebSearch for `"{framework} {generic error type}"` — sanitize first (strip hostnames, IPs, file paths, customer data).

## Phase 3: Hypothesis Testing

1. **Confirm:** Add temporary log/assertion at suspected root cause. Run reproduction.
2. **If wrong:** Sanitize error and search. Return to Phase 1. Do not guess.
3. **3-strike rule:** If 3 hypotheses fail, STOP. AskUserQuestion with options: continue, escalate, or instrument.

**Red flags:**
- "Quick fix for now" — there is no "for now"
- Proposing fix before tracing data flow — you're guessing
- Each fix reveals new problem — wrong layer, not wrong code

## Phase 4: Implementation

1. **Fix root cause, not symptom.** Smallest change that eliminates the actual problem.
2. **Minimal diff.** Fewest files, fewest lines. Don't refactor adjacent code.
3. **Regression test:** Fails without fix, passes with fix.
4. **Full test suite.** Paste output. No regressions.
5. **If >5 files touched:** AskUserQuestion about blast radius.

## Phase 5: Verification & Report

Reproduce original scenario — confirm fixed. Run test suite.

```
DEBUG REPORT
════════════════════════════════════════
Symptom:         [what the user observed]
Root cause:      [what was actually wrong]
Fix:             [what was changed, with file:line references]
Evidence:        [test output, reproduction showing fix works]
Regression test: [file:line of the new test]
Related:         [TODOS.md items, prior bugs in same area]
Status:          DONE | DONE_WITH_CONCERNS | BLOCKED
════════════════════════════════════════
```

## Important Rules

- 3+ failed fix attempts → STOP and question the architecture
- Never apply a fix you cannot verify
- Never say "this should fix it" — verify and prove it
- If fix touches >5 files → AskUserQuestion about blast radius
