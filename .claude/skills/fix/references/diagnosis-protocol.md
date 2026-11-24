# Diagnosis protocol

Prevents guessing. Quick profile confirms a known cause directly; standard and deep follow the phases.

## Baseline first

Capture before diagnosing, copy-pasted rather than paraphrased: the exact error, the failing test output with the command that produced it, relevant stack traces and log lines with timestamps, and `git log --oneline -10`. This is the baseline for verification.

## Phases

1. **Observe**: where does it occur (file, line, function), when did it start (`git log`, `git bisect`), does it reproduce every time or only with bounded evidence (attempts, rate, conditions, log correlation), and what is expected versus actual. `mk:investigate` collects this.
2. **Hypothesize** with `mk:sequential-thinking`: at least two hypotheses from the evidence, each with what would confirm and what would refute it. Usual categories: recent change, data or state mismatch, environment difference, missing validation, a wrong assumption.
3. **Test**: cheapest hypothesis first (a grep before a build). Mark each CONFIRMED, REFUTED or INCONCLUSIVE; refine or gather more on INCONCLUSIVE. Read-only searches may run in parallel (at most three) only when they cover independent areas.
4. **Trace**: follow symptom, immediate cause, contributing factor, root cause. Fix at the source, not where the error appears: a fix at the symptom hides the cause and the bug returns. `mk:investigate` has the tracing method. The output is the six-field proof in `SKILL.md`.
5. **Escalate**: when two or more hypotheses are refuted, consider environment (OS, runtime, dependency versions), ask what would cause this on purpose, and ask the user for context. The three-failed-fix-attempts stop is in `SKILL.md`.
