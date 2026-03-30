# Diagnosis Protocol

> Prevents the "guess root causes" anti-pattern.

## Pre-Diagnosis (MANDATORY)

Before ANY diagnosis, capture pre-fix state:

1. Exact error messages (copy-paste, not paraphrase)
2. Failing test output (full command + output)
3. Relevant stack traces
4. Relevant log snippets with timestamps
5. Recent changes: `git log --oneline -10`

This becomes the baseline for Step 5 verification.

## Phase 1: Observe (What is actually happening?)

Use `meow:investigate`:

- What is the exact error message?
- Where does it occur? (file, line, function)
- When did it start? (`git log`, `git bisect`)
- Can it be reproduced consistently?
- Expected vs actual behavior?

## Phase 2: Hypothesize (Why might this happen?)

Activate `meow:sequential-thinking`:

- Generate minimum 2 hypotheses from evidence
- For each: what would CONFIRM it? What would REFUTE it?
- Common categories:
  - Recent code change (regression)
  - Data/state mismatch
  - Environment difference
  - Missing validation
  - Incorrect assumption

## Phase 3: Test (Verify hypotheses)

Spawn parallel Explore subagents (max 3):

- Test cheapest hypothesis first (Grep before full build)
- Mark each: CONFIRMED | REFUTED | INCONCLUSIVE
- If INCONCLUSIVE → refine hypothesis or gather more evidence

## Phase 4: Trace (Follow the root cause chain)

Use `meow:investigate` (root-cause-tracing):

```
Symptom → Immediate cause → Contributing factor → ROOT CAUSE
```

**RULE:** NEVER fix where the error appears. Trace backward to source.

## Phase 5: Escalate (When hypotheses fail)

If 2+ hypotheses REFUTED:

- Consider environmental factors (OS, runtime version, dependency version)
- Apply inversion: "What would CAUSE this bug intentionally?"
- Ask user for additional context

If 3+ fix attempts fail after diagnosis:

- **STOP immediately**
- Question the architecture
- Discuss with user before attempting more
