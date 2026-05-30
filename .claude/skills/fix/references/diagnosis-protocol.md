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

Use `mk:investigate`:

- What is the exact error message?
- Where does it occur? (file, line, function)
- When did it start? (`git log`, `git bisect`)
- Can it be reproduced consistently?
- Expected vs actual behavior?

## Phase 2: Hypothesize (Why might this happen?)

Activate `mk:sequential-thinking`:

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

Use `mk:investigate` (root-cause-tracing):

```
Symptom → Immediate cause → Contributing factor → ROOT CAUSE
```

**RULE:** NEVER fix where the error appears. Trace backward to source.

### Output — Root-Cause Proof Checkpoint (six fields)

The pre-diagnosis capture (lines above) and this trace feed a single proof
checkpoint that gates Step 4 (Fix) in `SKILL.md` Step 2.5. Phase 4 MUST emit
all six fields before implementation begins:

1. **Exact symptom** — copy-pasted, not paraphrased (from Pre-Diagnosis #1-3).
2. **Deterministic reproduction** — exact command/steps (from Phase 1).
3. **Expected vs actual** — from Phase 1 observation.
4. **Root cause with `file:line`** — the traced source location, not the symptom site.
5. **Why now** — the change/condition that surfaced it (from Pre-Diagnosis #5 `git log`).
6. **Blast radius** — other callers/modules/behaviors the same root cause touches.

`--quick` compact form (still non-empty, one phrase each):
exact compiler/lint error · file · direct cause · command-before · command-after · impacted area.

## Phase 5: Escalate (When hypotheses fail)

If 2+ hypotheses REFUTED:

- Consider environmental factors (OS, runtime version, dependency version)
- Apply inversion: "What would CAUSE this bug intentionally?"
- Ask user for additional context

If 3+ fix attempts fail after diagnosis:

- **STOP immediately**
- Question the architecture
- Discuss with user before attempting more
