# Step 4: Gather — Cross-Batch Synthesis

Aggregate the findings from all batch researchers. Compute cross-batch frequency counts. Filter to patterns that exceed the threshold (≥3 occurrences). Identify cross-batch correlations a single agent would miss.

## Instructions

### 4a. Aggregate batch findings

Read all `$analysis_dir/batch-*-findings.json` files and merge by pattern name:

```bash
PY=".claude/skills/.venv/bin/python3"
[ -x "$PY" ] || PY="python3"

"$PY" -c "
import json, glob
from collections import defaultdict

aggregate = defaultdict(lambda: {'occurrences': 0, 'affected_runs': set(), 'samples': []})

for path in sorted(glob.glob('$analysis_dir/batch-*-findings.json')):
    with open(path) as f:
        findings = json.load(f)
    for entry in findings:
        name = entry.get('pattern', 'unknown')
        aggregate[name]['occurrences'] += entry.get('occurrences', 0)
        aggregate[name]['affected_runs'].update(entry.get('affected_runs', []))
        if entry.get('sample_record_ts'):
            aggregate[name]['samples'].append(entry['sample_record_ts'])

# Convert sets to sorted lists for JSON serialization
synthesized = {}
for name, data in aggregate.items():
    synthesized[name] = {
        'occurrences': data['occurrences'],
        'affected_runs': sorted(data['affected_runs']),
        'sample_count': len(data['samples']),
    }

with open('$analysis_dir/synthesized.json', 'w') as f:
    json.dump(synthesized, f, indent=2)

print(f'Aggregated {len(synthesized)} unique patterns across {sum(len(v[\"affected_runs\"]) for v in synthesized.values())} run-incidences')
"
```

### 4b. Apply frequency threshold

Filter to patterns with ≥3 total occurrences (anti-overfit):

```bash
"$PY" -c "
import json
with open('$analysis_dir/synthesized.json') as f:
    data = json.load(f)

# Filter
filtered = {k: v for k, v in data.items() if v['occurrences'] >= 3}
dropped = {k: v for k, v in data.items() if v['occurrences'] < 3}

with open('$analysis_dir/filtered.json', 'w') as f:
    json.dump(filtered, f, indent=2)

print(f'Threshold filter: {len(filtered)} patterns kept, {len(dropped)} dropped (occurrences < 3)')
if dropped:
    print('Dropped patterns:')
    for k, v in dropped.items():
        print(f'  - {k}: {v[\"occurrences\"]} occurrences')
"
```

### 4c. Identify cross-batch correlations

Optional: look for patterns that appeared in MULTIPLE batches (not just multiple runs in one batch). A pattern appearing in 2+ batches is more likely to be a real systemic issue, not a one-off:

```bash
"$PY" -c "
import json, glob
from collections import defaultdict

# Count which batches each pattern appears in
pattern_batches = defaultdict(set)
for i, path in enumerate(sorted(glob.glob('$analysis_dir/batch-*-findings.json'))):
    with open(path) as f:
        findings = json.load(f)
    for entry in findings:
        if entry.get('occurrences', 0) > 0:
            pattern_batches[entry['pattern']].add(i + 1)

with open('$analysis_dir/cross-batch.json', 'w') as f:
    json.dump({k: sorted(v) for k, v in pattern_batches.items()}, f, indent=2)

# Highlight patterns in multiple batches
multi_batch = {k: sorted(v) for k, v in pattern_batches.items() if len(v) >= 2}
if multi_batch:
    print('Cross-batch patterns (high signal):')
    for k, batches in multi_batch.items():
        print(f'  - {k}: appears in batches {batches}')
"
```

### 4d. Write findings.md

Compose a human-readable findings document at `$analysis_dir/findings.md`:

```markdown
# Trace Analysis Findings — {date}

**Records analyzed:** {N}
**Runs analyzed:** {M}
**Batches:** {batch_count}

## Patterns Detected (≥3 occurrences)

| Pattern | Occurrences | Affected Runs | In Batches |
|---|---|---|---|
| premature-exit-without-verify | 5 | 4 | 2/3 |
| doom-loop-edit-cycle | 3 | 2 | 1/3 |
| ... | ... | ... | ... |

## Patterns Below Threshold (Watch List)

- {pattern}: {N} occurrences (need ≥3)
- ...

## Cross-Batch Patterns (High Signal)

Patterns appearing in 2+ batches are systemic, not one-off:

- {pattern}: batches [{N}, {M}]
- ...
```

## Output

- `$analysis_dir/synthesized.json` — full aggregation
- `$analysis_dir/filtered.json` — patterns above threshold
- `$analysis_dir/cross-batch.json` — pattern → batch indices
- `$analysis_dir/findings.md` — human-readable report

Print: `"Synthesized {N} above-threshold patterns. See $analysis_dir/findings.md"`

## Next

Read and follow `step-05-suggestions.md`.
