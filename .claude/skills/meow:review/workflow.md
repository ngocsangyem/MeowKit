# Adversarial Code Review — Workflow

3-layer parallel review with triage. Replaces single-pass review.

## Rules

- NEVER load multiple step files simultaneously
- ALWAYS read entire step file before execution
- NEVER skip steps or optimize the sequence
- ALWAYS halt at triage and wait for human input on FAIL findings

## Steps

1. `step-01-gather-context.md` — Load diff, plan, acceptance criteria
2. `step-02-parallel-review.md` — Fan out 3 reviewers (Blind Hunter, Edge Case Hunter, Criteria Auditor)
3. `step-03-triage.md` — Categorize findings as current-change or incidental
4. `step-04-verdict.md` — Synthesize verdict, present to human for Gate 2

## Flow

```
Gather Context → Fan Out 3 Reviewers → Triage Findings → Verdict
                 ├─ Blind Hunter
                 ├─ Edge Case Hunter
                 └─ Criteria Auditor
```

## Next

Read and follow `step-01-gather-context.md`
