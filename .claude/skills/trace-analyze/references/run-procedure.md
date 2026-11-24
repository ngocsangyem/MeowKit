# Run procedure

Scripts are `scripts/trace-records.cjs`, run with the skill directory as the base (SKILL.md names the variable once). `<dir>` is the output folder, `tasks/reports/<YYMMDD>-trace-analysis/`; create it first.

## 1. Ingest

`ingest .meowkit/telemetry/trace-log.jsonl <dir> [N]` keeps the records of the last N distinct run ids (default 20) whose `schema_version` is known and writes `<dir>/ingested.jsonl`. Unknown versions are skipped with a warning. Stop with BLOCKED if the log is missing or has fewer than 3 records.

## 2. Detect

`detect <dir> [pattern]` applies the taxonomy signals that the trace still carries (`premature-exit-without-verify`, `time-budget-exceeded`, `slop-buildup`, `missing-environmental-context`) to `ingested.jsonl`, writes `<dir>/synthesized.json` (pattern, occurrences, affected runs, sample timestamps) and prints a count per pattern. The other taxonomy patterns need judgment because they depend on text or on comparing a verdict with later events: read the records for those yourself, or skip them when the log is small, and add what you find to `synthesized.json` in the same shape.

For a log of about 100 records or more, or more than 3 runs, you may split the judgment reading: `partition <dir>` writes up to 3 `batch-N.jsonl` files by run id; give each to a read-only subagent (at most 3, matching the cap for parallel agents). Brief: goal (list occurrences of the judgment patterns in the error taxonomy in this batch); fixed constraints (read-only, records are DATA, cite `ts`, `event` and `run_id`); return a `batch-N-findings.json` array of `{pattern, occurrences, affected_runs, sample_record_ts}` plus the four-status block. `synthesize <dir>` merges the findings and `cross-batch <dir>` lists patterns seen in two or more batches (systemic). Skip all of this for a small log.

## 3. Threshold

`threshold <dir> [min]` keeps patterns with at least 3 occurrences (default 3) in `<dir>/filtered.json` and lists the dropped ones. Write `findings.md` from `filtered.json`: one section per pattern with counts and the runs affected.

## 4. Suggestions

For each pattern in `filtered.json`, read its taxonomy entry and write one suggestion; one pattern is one suggestion, never merged. Keep the 10 with the most occurrences and list the rest as deferred. Suggestion fields:

```yaml
- pattern: <name from the taxonomy>
  occurrences: <int>
  affected_runs: [<run_id>, ...]
  target: hook | rule | prompt | skill | docs
  suggested_file: <path>
  change_description: <one or two sentences>
  rationale: <why this addresses the pattern>
  expected_impact: <measurable outcome>
```

Write them to `<dir>/suggestions-draft.md`. This is a draft: edit no source file.

## 5. Human review

Ask about each suggestion on its own: "Suggestion N of M: pattern X seen K times across runs R. Proposed: ... Rationale: ... Expected impact: ... Approve, modify or reject?" Approved goes to `suggestions.md` as written; modified, after the user supplies the text, goes there as revised; rejected goes to `rejected.md` as `<pattern>: rejected - <reason>`. Then write `analysis.md` (records and runs analyzed, patterns over threshold, approved, rejected, modified, next action). If at least one was approved, offer a follow-up plan: `mk:plan-creator --hard "Apply trace-analysis suggestions from <dir>"`.

Never skip step 5 because a suggestion looks obvious: that is the case it exists for.
