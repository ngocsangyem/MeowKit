---
title: "mk:investigate"
description: "Systematic 5-phase root cause debugging — observe, analyze, hypothesize, implement, verify. Read-only until hypothesis confirmed."
---

# mk:investigate

Systematic debugging with root cause investigation. Iron Law: no fixes without confirmed root cause. Read-only until hypothesis is confirmed — `mk:freeze` hook blocks edits during investigation.

## Usage

```bash
/mk:investigate "login fails after token refresh"
/mk:investigate "intermittent timeout on payment endpoint"
```

## When to use

- "debug this", "fix this bug", "why is this broken"
- Root cause analysis needed
- Troubleshooting unexpected behavior
- NOT for applying fixes without investigation (use `mk:fix`)
- NOT for step-by-step evidence-based reasoning (use `mk:sequential-thinking`)

## 5-phase debugging

1. **Investigate** — collect errors, traces, reproduction steps, relevant files
2. **Analyze** — trace backward from symptom to cause
3. **Hypothesize** — invoke `mk:sequential-thinking` to test each hypothesis with evidence
4. **Implement** — apply fix ONLY after root cause confirmed (confidence ≥ medium)
5. **Verify** — regression test required

## Constraints

- Read-only until hypothesis confirmed — `mk:freeze` hook on Edit/Write enforces scope boundary
- 3-strike rule: if 3 hypotheses fail, escalate to human — do not keep guessing
- > 5 files touched → `AskUserQuestion` about blast radius first
- Confidence below "medium" → gather more evidence, do not fix

## Handoff

After investigation produces a DEBUG REPORT, decide: fix needed → route to `mk:fix`. Fix not needed (deploy succeeded on retry, etc.) → document findings.
