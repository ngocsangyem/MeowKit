<!-- Extracted from SKILL.md for progressive disclosure (checklist #11, #14) -->
<!-- The actual debugging methodology — loaded when investigation begins -->

# Systematic Investigation Methodology

## Iron Law

**NO REMEDIATION WITHOUT ROOT CAUSE INVESTIGATION FIRST.**

Fixing symptoms creates whack-a-mole debugging. Find the root cause, then fix it.

---

## Phase 1: Root Cause Investigation

1. **Collect symptoms:** Read error messages, stack traces, reproduction steps. Ask ONE question at a time via stop and ask the user in chat if context is missing.
2. **Read the code:** Trace the code path from symptom back to potential causes. Use Grep to find all references, Read to understand logic.
3. **Check recent changes:** `git log --oneline -20 -- <affected-files>` — regression means root cause is in the diff.
4. **Reproduce:** Can you trigger the bug deterministically? If not, gather more evidence.

Output: **"Root cause hypothesis: ..."** — a specific, testable claim.

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

1. **Confirm:** Use existing logs, traces, read-only diagnostics, or an already available reproducer to test the suspected root cause.
2. **If wrong:** Sanitize error and search. Return to Phase 1. Do not guess.
3. **3-strike rule:** If 3 hypotheses fail, STOP. stop and ask the user in chat with options: continue, escalate, or instrument.

**Red flags:**
- "Quick fix for now" — there is no "for now"
- Proposing fix before tracing data flow — you're guessing
- Each fix reveals new problem — wrong layer, not wrong code

## Phase 4: Diagnostic Report & Handoff

Write the report to `tasks/reports/**` and hand off remediation only after the
cause is confirmed. `mk:fix` implements observed defects; `mk:build-fix` owns
compile/build failures. If the cause remains uncertain, state that clearly and
ask for the next diagnostic step.

```
DEBUG REPORT
════════════════════════════════════════
Symptom:         [what the user observed]
Root cause:      [confirmed cause or explicit uncertainty]
Ranked causes:   [most likely → least likely]
Evidence:        [logs, traces, reproduction result]
Blast radius:    [affected callers, modules, behaviors]
Next owner:      [mk:fix | mk:build-fix | user]
Related:         [TODOS.md items, prior bugs in same area]
Status:          DONE | DONE_WITH_CONCERNS | BLOCKED
════════════════════════════════════════
```

## Important Rules

- 3+ failed hypotheses → STOP and question the architecture
- Never claim a fix was applied or verified by this skill
- Never say "this should fix it" — report evidence and route to the correct owner
