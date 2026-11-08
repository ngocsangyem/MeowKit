# Step 2: Partition Records into Batches

Group records by `run_id` and split into ≤3 batches for the scatter step. Honors the `.claude/skills/cook/references/parallel-execution-rules.md` Rule 2 max-3-agents cap.

## Instructions

### 2a. Group by run_id

```bash
node .claude/skills/trace-analyze/scripts/trace-records.cjs partition "$analysis_dir"
```

Writes `batch-{N}.jsonl` for each batch and prints one line per batch plus a
final `BATCH_COUNT={n}` line.

### 2b. Persist batch metadata

After the python invocation, capture:
- `batch_count` — number of batches actually created (1, 2, or 3)
- `batch_paths` — list of `$analysis_dir/batch-{N}.jsonl` paths

### 2c. Sanity check

If `batch_count == 0`: halt and report. There were records but no run_ids — likely all records had empty `run_id`. Document this as a trace-emission bug to fix.

## Output

- `$analysis_dir/batch-1.jsonl` (and batch-2, batch-3 if applicable)
- `batch_count` set
- Print: `"Partitioned {N} runs into {batch_count} batches"`

## Next

Read and follow `step-03-scatter-analysis.md`.
