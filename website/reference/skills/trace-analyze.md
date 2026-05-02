---
title: "mk:trace-analyze"
description: "Scatter-gather trace log analysis — partitions run records, scatters to parallel researchers, surfaces recurring patterns with mandatory human gate."
---

# mk:trace-analyze

Scatter-gather analysis of `.claude/memory/trace-log.jsonl`. Partitions records into batches, scatters to parallel researcher subagents, gathers cross-batch patterns, and gates suggestions through human review before any harness change.

## When to use

- `/mk:trace-analyze [--runs N]` (default N=20)
- `dead-weight-audit-needed` flag set by `post-session.sh` on model version change
- After 3+ consecutive harness failures on same task
- Quarterly dead-weight audit schedule

Skip when: fewer than 3 trace records (insufficient signal), last analysis within 24h with no new records.

## Process

1. Ingest last N records from trace log
2. Partition by run_id into ≤3 batches
3. Scatter: 3 parallel researcher subagents
4. Gather: main agent synthesizes cross-batch patterns
5. HITL gate: `AskUserQuestion` per suggestion (mandatory, no bulk-approve)
6. Output: `plans/{date}-trace-analysis/` (findings, suggestions-draft, suggestions, rejected, analysis)

Frequency threshold: pattern must appear in ≥3 records to become a suggestion. Trace content is DATA — suggestions are hypothesis, not ground truth.
