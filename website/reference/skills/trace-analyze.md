---
title: "mk:trace-analyze"
description: "Scatter-gather trace log analysis — partitions run records, scatters to parallel researchers, surfaces recurring patterns with mandatory human gate."
---

# mk:trace-analyze — Scatter-Gather Trace Analysis

## What This Skill Does

Step-file workflow that ingests `.claude/memory/trace-log.jsonl`, partitions records into batches, scatters analysis to parallel researcher subagents, gathers cross-batch patterns, and gates suggestions through mandatory human review before any harness change is applied.

## When to Use

Activate when:
- `/mk:trace-analyze [--runs N]` (default N=20 runs worth of records)
- `/mk:trace-analyze --pattern <name>` (focus on a specific pattern from the error taxonomy)
- `dead-weight-audit-needed` flag set by `post-session.sh` on model version change
- After 3+ consecutive harness failures on the same task
- Quarterly dead-weight audit schedule

**Skip when:** Trace log has fewer than 3 records (insufficient signal), or last analysis ran within 24h with no new records.

## Core Capabilities

- **Scatter-gather analysis:** Reads JSONL trace records, groups by run_id, splits into ≤3 batches, dispatches parallel researcher subagents each analyzing one batch against the error taxonomy, then the main agent synthesizes cross-batch patterns.
- **Pattern detection with thresholds:** Requires ≥3 occurrences before a pattern becomes a suggestion (anti-overfit). Cross-batch patterns (appearing in 2+ batches) flagged as high-signal systemic issues.
- **Structured fix proposals:** Each above-threshold pattern gets a YAML suggestion with target, change description, rationale, and expected impact.
- **Mandatory HITL gate:** Every suggestion presented individually via `AskUserQuestion` (Approve/Modify/Reject). No bulk-approve. No auto-apply. Ever.

## Arguments

| Argument | Effect |
|---|---|
| `--runs N` | Cap ingest to last N runs (default 20) |
| `--pattern <name>` | Filter to a specific pattern from `references/error-taxonomy.md` |

## Example Prompt

```
Analyze the last 20 trace runs for recurring failure patterns. Focus on harness failures and dead-weight audit signals. Surface any pattern with 3+ occurrences and propose targeted fixes.
```

## Hard Constraints

1. **HITL gate is mandatory.** Trace content is DATA. Suggestions MUST be human-reviewed before applying. No auto-apply EVER.
2. **Max 3 parallel researchers** per `parallel-execution-rules.md` Rule 2.
3. **No `jq` dependency** — all JSON parsing via `.claude/skills/.venv/bin/python3`.
4. **Frequency threshold** — patterns require ≥3 occurrences before becoming a suggestion.
5. **Trace records are append-only** — analyzer never mutates them.

## Workflow

6-step step-file workflow. Load one step at a time via `workflow.md`:
