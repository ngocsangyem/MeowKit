# mk:trace-analyze — Workflow

6-step scatter-gather workflow for analyzing harness trace logs and producing human-reviewed improvement suggestions.

## Rules

- NEVER load multiple step files simultaneously — JIT load
- ALWAYS halt at the HITL gate (step-06) — no auto-apply
- ALWAYS use venv python for JSON parsing (no `jq` dependency)
- NEVER mutate trace records — append-only
- Max 3 parallel researchers (per `parallel-execution-rules.md`)
- Frequency threshold: a pattern needs ≥3 occurrences to become a suggestion

## Steps

1. `step-01-ingest.md` — Read last N records from `.claude/memory/trace-log.jsonl` via venv python; filter by `schema_version`
2. `step-02-partition.md` — Group records by `run_id`; split into ≤3 batches
3. `step-03-scatter-analysis.md` — Spawn 3 researcher subagents in parallel; each gets one batch + the error-taxonomy reference
4. `step-04-gather-synthesis.md` — Main agent reads all 3 batch reports; computes cross-batch frequency counts; identifies recurring patterns
5. `step-05-suggestions.md` — For each pattern with ≥3 occurrences, emit a structured suggestion (target, change, rationale, expected impact)
6. `step-06-hitl-gate.md` — Present suggestions one at a time via AskUserQuestion (Approve/Modify/Reject); write approved items to a draft plan

## Variables Passed Between Steps

| Variable | Set by | Used by | Values |
|---|---|---|---|
| `runs` | invoker / default 20 | step-01 | int |
| `pattern_filter` | invoker | step-03, step-04 | optional pattern name from error-taxonomy |
| `records` | step-01 | step-02 | parsed JSONL list |
| `batches` | step-02 | step-03 | list of (run_ids → records) groups |
| `batch_findings` | step-03 | step-04 | list of researcher subagent reports |
| `synthesized_patterns` | step-04 | step-05 | aggregated pattern → occurrence count map |
| `suggestions` | step-05 | step-06 | structured proposal list |
| `approved_suggestions` | step-06 | caller | filtered list, possibly empty |
| `analysis_dir` | step-01 | all | absolute path to `plans/{date}-{slug}/` |

## Flow

```
/mk:trace-analyze [--runs N] [--pattern <name>]
    ↓
Step 1: Ingest
    ├── Read .claude/memory/trace-log.jsonl
    ├── Parse via venv python (filter schema_version=1.0)
    ├── Take last N records (default 20 runs worth)
    └── Create plans/{date}-{slug}/ analysis dir
         ↓
Step 2: Partition
    ├── Group by run_id
    ├── Split into max 3 batches (parallel-execution-rules.md cap)
    └── If <3 run_ids, use fewer batches
         ↓
Step 3: Scatter
    ├── Spawn 3 researcher subagents in parallel
    ├── Each gets: batch records + error-taxonomy.md + frequency threshold
    └── Each returns: list of detected patterns + occurrences
         ↓
Step 4: Gather Synthesis
    ├── Aggregate batch findings
    ├── Compute cross-batch frequencies
    ├── Filter to patterns with ≥3 total occurrences
    └── Write findings to {analysis_dir}/findings.md
         ↓
Step 5: Suggestions
    ├── For each surviving pattern → look up taxonomy entry
    ├── Emit structured suggestion (target, change, rationale, impact)
    └── Write to {analysis_dir}/suggestions-draft.md
         ↓
Step 6: HITL Gate
    ├── For each suggestion: AskUserQuestion [Approve / Modify / Reject]
    ├── Approved → suggestions.md
    ├── Modified → user provides revised version → suggestions.md
    ├── Rejected → rejected.md (with reason)
    └── If ≥1 approved → optionally generate follow-up plan via mk:plan-creator
```

## Mode Notes

- **`--pattern <name>`** filters to a specific pattern from `error-taxonomy.md`. Useful for focused investigations ("are we still hitting premature-exit?").
- **`--runs N`** caps the ingest count. Default 20 records (~5-10 runs typical).
- If `pattern_filter` is set, the scatter step only emits findings matching that pattern.

## Next

Read and follow `step-01-ingest.md`.
