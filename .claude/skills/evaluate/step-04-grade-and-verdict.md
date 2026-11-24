# Step 4: Grade and Write Verdict

Aggregate findings into per-rubric verdicts, write the verdict file at the canonical path, and run `validate-verdict.sh` to enforce the active-verification requirement.

## Instructions

### 4a. Aggregate findings per rubric

Group `findings` from step-03 by rubric name. For each rubric, derive a single verdict from its findings:

| Per-rubric grading rule | Result |
|---|---|
| Any criterion FAIL | Rubric verdict = FAIL |
| No FAIL but ≥1 WARN | Rubric verdict = WARN |
| All criteria PASS | Rubric verdict = PASS |

### 4b. Weighted score, hard-fail check, overall

Scoring model (this file is its single owner): PASS = 1.0, WARN = 0.5, FAIL = 0.0, and `weighted_score` is the sum of each rubric's weight times its value, rounded to two decimals.

- **Hard fail:** each rubric has a `hard_fail_threshold` (`FAIL` or `WARN`, from the rubric library). If any rubric verdict reaches its threshold, `overall` is FAIL whatever the score. A soft average does not save a weak dimension.
- **Overall:** otherwise PASS at 0.85 or above, WARN at 0.65 or above, FAIL below.

Do not compute this by hand. Write the verdict file in 4e with the per-rubric headers (each carries its weight and verdict) and placeholder frontmatter values, then run:

```bash
python3 scripts/recompute-score.py "$verdict_file"
```

It prints JSON with `recomputed_score`, `expected_overall` and `hard_fail_triggered`; put those into the frontmatter (`weighted_score`, `overall`, `hard_fail_triggered`), then validate in 4f.

### 4e. Write the verdict file

Path: `tasks/reviews/{date}-{slug}-evalverdict.md`: the evidence directory's name with `-evidence` removed and `.md` added.

```markdown
---
task: {task-name}
slug: {slug}
evaluator_run: {ISO-8601 timestamp}
rubric_preset: {preset-name}
model: {model-id}
evaluator: {agent: evaluator, session: {host-session-id}, date: {YYYY-MM-DD}}
overall: PASS | WARN | FAIL
weighted_score: 0.78
hard_fail_triggered: false
iterations: {N — incremented per generator loop}
batch_index: {if multi-batch}
batches_total: {if multi-batch}
---
```

**`evaluator:` is REQUIRED (validator v2).** It records who produced the verdict — anti-accidental provenance, not an unforgeable identity. **`weighted_score` and `overall` are recomputed and checked by the validator** from the per-rubric verdicts below and the preset's canonical weights: a declared score/overall that does not follow from the per-rubric verdicts (a forged PASS) is rejected. Emit the per-rubric section with EVERY preset rubric exactly once, each header carrying its weight and verdict:

> **Boundary (anti-accidental, not unforgeable):** the validator checks that the score and overall *follow from* the per-rubric verdicts — it does NOT judge whether each per-rubric verdict is itself honest. A self-consistent fabricated verdict (every rubric marked PASS with weak evidence) still passes recompute; catching that is the skeptic-evaluator's job (Rule 9) and the evidence's, not this arithmetic check. The check closes the *inconsistent* forgery (PASS with a score that cannot be derived), which is the forged-PASS shape.

```markdown

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

### 4f. Run validate-verdict.sh

This is where active verification is enforced. Run after writing the verdict file:

```bash
scripts/validate-verdict.sh "$verdict_file"
```

The validator checks (v2):
1. Frontmatter has all required fields, including the `evaluator:` identity block
2. `evidence_dir` exists and is non-empty (the active-verification requirement)
3. Every PASS/WARN rubric cites at least one evidence file in its section
4. Evidence files referenced in the verdict actually exist on disk; a per-file SHA-256 + type manifest is written next to the evidence dir
5. `weighted_score` is RECOMPUTED from the preset weights × per-rubric verdicts and must match the declared value within 0.01
6. Rubric coverage: every preset rubric appears exactly once (no missing, extra, or duplicate)
7. `overall` matches the derivation rules in 4d, and any triggered hard-fail forces `hard_fail_triggered: true`

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

- validator_version: 2.0.0
- validated_at: {ISO-8601}
- evidence_files_counted: 7
- score_recomputed: true
- verdict_accepted: true
```

This proves the verdict survived the active-verification requirement.

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
