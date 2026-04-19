# Step 1: Ingest Trace Records

Read the last N records from `.claude/memory/trace-log.jsonl` via venv python. Filter by schema_version. Create the analysis directory.

## Instructions

### 1a. Verify trace log exists

```bash
TRACE_LOG=".claude/memory/trace-log.jsonl"
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

### 1c. Read records via venv python

Use `.claude/skills/.venv/bin/python3` (per `rules/` §4 — no `jq` dependency):

```bash
PY=".claude/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="python3"

"$PY" -c "
import json, sys

LIMIT = ${runs:-20}  # default 20 runs worth
records = []
with open('$TRACE_LOG') as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
        except (json.JSONDecodeError, ValueError):
            continue
        # Schema version filter
        if r.get('schema_version', '') not in ('1.0',):
            sys.stderr.write('WARN: skipping unknown schema_version: ' + str(r.get('schema_version', '')) + '\n')
            continue
        records.append(r)

# Take last LIMIT runs (group by run_id, take last LIMIT distinct ids)
seen_runs = []
for r in reversed(records):
    rid = r.get('run_id', '')
    if rid and rid not in seen_runs:
        seen_runs.append(rid)
    if len(seen_runs) >= LIMIT:
        break

# Filter records to those in the selected runs
selected = [r for r in records if r.get('run_id', '') in seen_runs]

# Write to a temp file for the next step
with open('$analysis_dir/ingested.jsonl', 'w') as out:
    for r in selected:
        out.write(json.dumps(r) + '\n')

print(f'Ingested {len(selected)} records across {len(seen_runs)} runs')
"
```

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
