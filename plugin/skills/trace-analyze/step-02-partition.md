# Step 2: Partition Records into Batches

Group records by `run_id` and split into ≤3 batches for the scatter step. Honors the `parallel-execution-rules.md` Rule 2 max-3-agents cap.

## Instructions

### 2a. Group by run_id

```bash
PY=".claude/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="python3"

"$PY" -c "
import json, math

records = []
with open('$analysis_dir/ingested.jsonl') as f:
    for line in f:
        line = line.strip()
        if line:
            records.append(json.loads(line))

# Group by run_id (preserve insertion order)
runs = {}
for r in records:
    rid = r.get('run_id', '_unknown')
    runs.setdefault(rid, []).append(r)

run_ids = list(runs.keys())
print(f'Found {len(run_ids)} distinct runs')

# Split into max 3 batches
n_batches = min(3, len(run_ids))
if n_batches == 0:
    print('ERROR: no runs to partition')
    exit(1)

per_batch = math.ceil(len(run_ids) / n_batches)
batches = [run_ids[i*per_batch:(i+1)*per_batch] for i in range(n_batches)]

# Write each batch to a file
for i, batch_run_ids in enumerate(batches):
    if not batch_run_ids:
        continue
    batch_records = []
    for rid in batch_run_ids:
        batch_records.extend(runs[rid])
    with open(f'$analysis_dir/batch-{i+1}.jsonl', 'w') as out:
        for r in batch_records:
            out.write(json.dumps(r) + '\n')
    print(f'Batch {i+1}: {len(batch_run_ids)} runs, {len(batch_records)} records')

print(f'BATCH_COUNT={n_batches}')
"
```

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
