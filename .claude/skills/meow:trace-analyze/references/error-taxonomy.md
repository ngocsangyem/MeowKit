# Error Taxonomy

Catalog of known harness failure patterns. Used by `meow:trace-analyze` step-03 (scatter analysis) to classify trace findings into actionable categories. Seeded from LangChain published patterns + Anthropic harness research.

## Pattern Schema

Each entry has:
- **Pattern name** — kebab-case identifier
- **Trace signal** — JSONL record fields that match this pattern
- **Frequency threshold** — minimum occurrences before suggesting a fix (prevents overfitting on one bad run)
- **Root cause** — why the failure happens
- **Suggested mitigation** — concrete harness fix

## Patterns from LangChain (deepagents harness research)

### `premature-exit-without-verify`

- **Trace signal:** session_end record with NO preceding `verdict_written` record AND NO `build_verify_result` exit_code=0 in the same session
- **Threshold:** ≥3 sessions in last 20 runs
- **Root cause:** Agent writes code, re-reads its own code, declares done, stops. Self-verification is bolted on, not native.
- **Mitigation:** PreCompletion hook (already in Phase 7 — verify it's firing). If still happening, tighten the hook's evidence detection; add explicit "did you actually run the build?" prompt to developer.md.

### `doom-loop-edit-cycle`

- **Trace signal:** ≥3 `loop_warning` records on the same `data.file` within one run_id
- **Threshold:** ≥2 runs in last 20
- **Root cause:** Agent making repeated small variations to the same file without progress. Flawed approach masquerading as iteration.
- **Mitigation:** LoopDetection hook (Phase 7) is firing — if pattern persists, lower the warning threshold from N=4 to N=3, OR add explicit "halt and re-plan" guidance to developer.md.

### `missing-environmental-context`

- **Trace signal:** `file_edited` records on files matching `**/package.json` or `**/Cargo.toml` early in a run_id (within first 5 events) — agent searching for tool config instead of using LocalContext
- **Threshold:** ≥3 runs
- **Root cause:** Agent fails search + discovery, doesn't use LocalContext expansion from project-context-loader.sh
- **Mitigation:** Verify LocalContext block is firing (Phase 7 extension to project-context-loader.sh). Check session-start trace for the LocalContext output. If missing, fix the hook.

### `time-budget-exceeded`

- **Trace signal:** session_end record with `duration_seconds > 21600` (6h hard timeout) AND no `verdict_written` record
- **Threshold:** ≥1 occurrence (catastrophic — one is enough)
- **Root cause:** Agent ran past the 6h harness wall-clock without completing verification.
- **Mitigation:** Document. Investigate manually — likely a doom loop OR an unrecoverable build error. If recurring, lower iteration cap from 3 to 2.

### `slop-buildup`

- **Trace signal:** `verdict_written` records with `data.weighted_score < 0.6` AND `originality: FAIL` OR `design-quality: FAIL`
- **Threshold:** ≥3 runs in last 20
- **Root cause:** Generator producing AI slop (purple gradients, generic copy, stock illustrations).
- **Mitigation:** Verify rubric anti-pattern lists are loaded (originality.md / design-quality.md). Add explicit anti-slop examples to the planner's product spec template.

### `compile-break-ignored`

- **Trace signal:** `build_verify_result` with non-zero exit_code, followed by another `file_edited` on the same file WITHOUT a subsequent successful `build_verify_result`
- **Threshold:** ≥3 occurrences
- **Root cause:** Build-Verify hook fires but agent doesn't fix the error before next edit.
- **Mitigation:** Make Build-Verify error output more prominent in the agent's context. Consider Stop-event check: refuse to allow Stop if last file's Build-Verify is failing.

### `reasoning-budget-mismatch`

- **Trace signal:** `cost_sample` records show high USD per step on TRIVIAL-density runs, OR low USD on COMPLEX-density runs
- **Threshold:** ≥5 runs
- **Root cause:** Wrong density mode for the actual task complexity.
- **Mitigation:** Improve `density-select.sh` heuristics; tighten the model→tier mapping.

## Patterns from Anthropic harness research

### `self-praise-approval`

- **Trace signal:** `verdict_written` with `overall: PASS` followed by user manual override OR a follow-up plan addressing the same task within 24h
- **Threshold:** ≥2 occurrences
- **Root cause:** Out-of-box Claude as a QA agent identifies legitimate issues, then talks itself into approving them. Leniency drift.
- **Mitigation:** Verify skeptic persona is being reloaded per criterion (Phase 3 evaluator). Strengthen the persona prompt; add more anti-rationalization counters.

### `stub-feature`

- **Trace signal:** `verdict_written` with `data.functionality: FAIL` AND fix-guidance contains "no handler" / "stub" / "not wired" / "TODO"
- **Threshold:** ≥3 runs
- **Root cause:** Generator marks features as "done" when only the UI shell exists; no backing logic.
- **Mitigation:** Tighten developer.md self-eval checklist (item 5: "≥1 core criterion smoke-passed" — make this REQUIRED to fire actual UI interaction, not just visual inspection).

### `contract-drift`

- **Trace signal:** `contract_signed` followed by `file_edited` records on files matching the contract's Scope (Out) section
- **Threshold:** ≥2 occurrences
- **Root cause:** Generator exceeds contract scope without amendment.
- **Mitigation:** Stronger contract discipline rule in developer.md. Optional: hook that diffs git changes against contract scope before allowing commits.

### `context-anxiety-wrap` (LEGACY)

- **Trace signal:** Sonnet 4.5 `session_end` records with abnormally low duration AND no failure markers
- **Threshold:** N/A — should not appear on Opus 4.6+
- **Root cause:** Model gets anxious about context limits, exits early.
- **Mitigation:** Move to Opus 4.6+. This pattern is the main reason for the LEAN density mode.

## Suggestion Format

When `meow:trace-analyze` step-05 emits suggestions, each entry must include:

```yaml
- pattern: <pattern-name from this taxonomy>
  occurrences: <int>
  affected_runs: [<run_id>, ...]
  target: hook | rule | prompt | skill | docs
  change_description: <one sentence>
  rationale: <why this fix addresses the pattern>
  expected_impact: <measurable outcome — "should reduce occurrences by ~50%">
  suggested_file: <path to file that needs editing>
```

The HITL gate at step-06 presents these suggestions one at a time for Approve / Modify / Reject.

## Adding New Patterns

Patterns evolve as new failure modes are discovered. To add a pattern:

1. Identify a recurring failure in trace-analyze findings (≥3 occurrences across ≥2 runs)
2. Write the trace signal — exact JSONL fields/values to grep for
3. Set frequency threshold (start at 3, raise if false-positives)
4. Document root cause (why this happens)
5. Propose mitigation (which hook/rule/prompt to change)
6. Add the entry to this file
7. Re-run `meow:trace-analyze` with the new pattern in the taxonomy
