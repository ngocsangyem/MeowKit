# Step 1: Ingest Trace Records

Read the last N records from `.meowkit/telemetry/trace-log.jsonl` on node. Filter by schema_version. Create the analysis directory.

## Instructions

### 1a. Verify trace log exists

```bash
TRACE_LOG=".meowkit/telemetry/trace-log.jsonl"
if [ ! -f "$TRACE_LOG" ]; then
  echo "BLOCKED: trace log not found at $TRACE_LOG. Run some harness sessions first to populate it." >&2
  exit 1
fi
```

### 1b. Create analysis directory

```bash
date_prefix=$(date +%y%m%d)
slug="trace-analysis"
analysis_dir="plans/${date_prefix}-${slug}"
mkdir -p "$analysis_dir"
```

### 1c. Read records

JSON parsing runs on node — guaranteed present, and no `jq` dependency:

```bash
node .claude/skills/trace-analyze/scripts/trace-records.cjs ingest \
  "$TRACE_LOG" "$analysis_dir" "${runs:-20}"
```

Records whose `schema_version` is not `1.0` are skipped with a `WARN` on stderr.
Prints `Ingested {N} records across {M} runs`.

### 1d. Sanity-check the count

If fewer than 3 records were ingested:

```
Halt with message: "Insufficient trace data: only {N} records in {M} runs. Need ≥3 records (preferably ≥20) for meaningful analysis. Run more harness sessions and try again."
```

### 1e. Persist session vars

- `analysis_dir` — absolute path to the analysis directory
- `ingested_records_path` — `$analysis_dir/ingested.jsonl`
- `record_count` — number of records ingested
- `run_count` — number of distinct run_ids

## Output

- `$analysis_dir/ingested.jsonl` — selected records ready for partitioning
- Print: `"Ingested {N} records across {M} runs. Analysis dir: $analysis_dir"`

## Next

Read and follow `step-02-partition.md`.
