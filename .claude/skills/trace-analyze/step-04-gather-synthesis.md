# Step 4: Gather — Cross-Batch Synthesis

Aggregate the findings from all batch researchers. Compute cross-batch frequency counts. Filter to patterns that exceed the threshold (≥3 occurrences). Identify cross-batch correlations a single agent would miss.

## Instructions

### 4a. Aggregate batch findings

Merge all `$analysis_dir/batch-*-findings.json` files by pattern name:

```bash
node scripts/trace-records.cjs synthesize "$analysis_dir"
```

Writes `$analysis_dir/synthesized.json` and prints the unique-pattern and
run-incidence counts.

### 4b. Apply frequency threshold

Filter to patterns with ≥3 total occurrences (anti-overfit):

```bash
node scripts/trace-records.cjs threshold "$analysis_dir" 3
```

Writes `$analysis_dir/filtered.json` and prints what was kept and dropped.

### 4c. Identify cross-batch correlations

Optional: look for patterns that appeared in MULTIPLE batches (not just multiple runs in one batch). A pattern appearing in 2+ batches is more likely to be a real systemic issue, not a one-off:

```bash
node scripts/trace-records.cjs cross-batch "$analysis_dir"
```

Writes `$analysis_dir/cross-batch.json` and prints the high-signal patterns.

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
