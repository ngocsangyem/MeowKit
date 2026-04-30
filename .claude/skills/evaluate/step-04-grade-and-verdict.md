# Step 4: Grade and Write Verdict

Aggregate findings into per-rubric verdicts, compute the weighted score, write the verdict file at the canonical path, and run `validate-verdict.sh` to enforce the active-verification gate.

## Instructions

### 4a. Aggregate findings per rubric

Group `findings` from step-03 by rubric name. For each rubric, derive a single verdict from its findings:

| Per-rubric grading rule | Result |
|---|---|
| Any criterion FAIL | Rubric verdict = FAIL |
| No FAIL but ≥1 WARN | Rubric verdict = WARN |
| All criteria PASS | Rubric verdict = PASS |

### 4b. Compute weighted score

Pull weights from `composed_rubrics` (set in step-01). For each rubric, compute its contribution:

| Verdict | Numeric value |
|---|---|
| PASS | 1.0 |
| WARN | 0.5 |
| FAIL | 0.0 |

```
weighted_score = sum(rubric_weight * verdict_value for each rubric)
```

Range: 0.0 to 1.0. Rounded to 2 decimals.

### 4c. Check hard-fail thresholds

Per `mk:rubric` schema, each rubric has a `hard_fail_threshold` (`FAIL` or `WARN`). Iterate the per-rubric verdicts:

```
hard_fail_triggered = false
for rubric in composed_rubrics:
    if rubric_verdict >= rubric.hard_fail_threshold:
        hard_fail_triggered = true
        break
```

If `hard_fail_triggered`, the overall verdict is **FAIL** regardless of weighted score. Soft averages do not save weak dimensions — this is the rubric library's hard-fail semantic.

### 4d. Determine overall verdict

```
if hard_fail_triggered:
    overall = FAIL
elif weighted_score >= 0.85:
    overall = PASS
elif weighted_score >= 0.65:
    overall = WARN
else:
    overall = FAIL
```

### 4e. Write the verdict file

Path: `tasks/reviews/${MEOWKIT_EVAL_SLUG}-evalverdict.md`

**Slug consistency:** read `MEOWKIT_EVAL_SLUG` (set by step-01 §1g) — do NOT re-derive the slug here. Step-01 owns the slug-source priority (task slug → contract slug → branch slug → cwd basename). Re-deriving in step-04 risks divergence between the evidence directory path (set in step-01) and the verdict file path, which corrupts the relative-path citations the validator follows.

```markdown
---
task: {task-name}
slug: {slug}
evaluator_run: {ISO-8601 timestamp}
rubric_preset: {preset-name}
model: {model-id}
overall: PASS | WARN | FAIL
weighted_score: 0.78
hard_fail_triggered: false
iterations: {N — incremented per generator loop}
batch_index: {if multi-batch}
batches_total: {if multi-batch}
---

# Evaluation Verdict — {task name}

## Summary

{1-paragraph honest summary. Lead with the headline. No vibes — cite specific rubrics.}

## Per-Rubric Results

### {rubric-name} (weight {N}, hard_fail {threshold}) — {VERDICT}

- **Criterion:** "{criterion text}" — {PASS/WARN/FAIL}
  - **Evidence:** `{evidence_path}`
  - **Reasoning:** {anchor pattern match — quote the rubric anchor that matched}
  - **Fix guidance:** {specific actionable, only if WARN/FAIL}

(repeat per criterion under each rubric)

## Iteration Feedback (for generator)

(populated by step-05, but the section header is created here for forward reference)

## Validator Stamp

(populated by validate-verdict.sh — see 4f)
```

### 4f. Run validate-verdict.sh — HARD GATE

This is the active-verification enforcement. Run after writing the verdict file:

```bash
.claude/skills/evaluate/scripts/validate-verdict.sh "$verdict_file"
```

The validator checks:
1. Frontmatter has all required fields
2. `evidence_dir` exists and is non-empty (per the active-verification HARD GATE locked 260408)
3. Every PASS verdict on `functionality` rubric cites at least one evidence file in the directory
4. Evidence files referenced in the verdict actually exist on disk
5. `weighted_score` matches the recomputed value (no manual fudging)
6. `overall` matches the derivation rules in 4d

**If validator exits non-zero:**

- Read the diagnostics
- If the failure is "PASS without evidence" → convert that PASS to FAIL with reason "no active verification performed". Re-run validator
- If the failure is "evidence file does not exist" → either fix the path or re-probe to capture the missing artifact
- If the failure is "weighted score mismatch" → recompute and rewrite

Do NOT proceed to step-05 until the validator exits 0 and stamps the verdict.

### 4g. Stamp the verdict

The validator appends a stamp section to the verdict file:

```markdown
## Validator Stamp

- validator_version: 1.0.0
- validated_at: {ISO-8601}
- evidence_files_counted: 7
- verdict_accepted: true
```

This proves the verdict survived the active-verification gate.

## Multi-Batch Merge

If `batches_total > 1`, this step runs once per batch but the LAST batch also performs a merge:

1. Read all prior batch verdicts from `tasks/reviews/{slug}-evalverdict-batch-{N}.md`
2. Aggregate per-rubric verdicts across batches (worst-case wins: any FAIL → FAIL; any WARN → WARN; all PASS → PASS)
3. Recompute `weighted_score` using merged rubric verdicts
4. Recompute `overall`
5. Write final verdict to `tasks/reviews/{slug}-evalverdict.md` (no batch suffix)
6. Run validator on the final verdict

## Output

- `verdict_file` — absolute path
- `overall_verdict` — PASS | WARN | FAIL
- `weighted_score` — float
- `hard_fail_triggered` — bool

Print: `"Verdict: {overall} (weighted {score:.2f}). File: {verdict_file}"`

## Next

Read and follow `step-05-feedback-to-generator.md`.
