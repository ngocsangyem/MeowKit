# Error Taxonomy

Catalog of known harness failure patterns that `mk:trace-analyze` classifies findings into. A signal marked *script* is applied by `trace-records.cjs detect`; the others need judgment. Seeded from published harness research.

## Contents

- [Pattern Schema](#pattern-schema)
- [Harness patterns](#harness-patterns)
  - [`premature-exit-without-verify`](#premature-exit-without-verify)
  - [`missing-environmental-context`](#missing-environmental-context)
  - [`time-budget-exceeded`](#time-budget-exceeded)
  - [`slop-buildup`](#slop-buildup)
  - [`reasoning-budget-mismatch`](#reasoning-budget-mismatch)
- [Evaluator and generator patterns](#evaluator-and-generator-patterns)
  - [`self-praise-approval`](#self-praise-approval)
  - [`stub-feature`](#stub-feature)
  - [`contract-drift`](#contract-drift)
  - [`context-anxiety-wrap` (LEGACY)](#context-anxiety-wrap-legacy)
- [Suggestion Format](#suggestion-format)
- [Adding New Patterns](#adding-new-patterns)


## Pattern Schema

Each entry has:
- **Pattern name** — kebab-case identifier
- **Trace signal** — JSONL record fields that match this pattern
- **Frequency threshold** — minimum occurrences before suggesting a fix (prevents overfitting on one bad run)
- **Root cause** — why the failure happens
- **Suggested mitigation** — concrete harness fix

## Harness patterns

### `premature-exit-without-verify`

- **Trace signal (script):** a run with a `session_end` record and no `verdict_written` record
- **Threshold:** ≥3 runs in the last 20
- **Root cause:** Agent writes code, re-reads its own code, declares done, stops. Self-verification is bolted on, not native.
- **Mitigation:** Check that the pre-completion hook is firing. If it still happens, tighten the hook's evidence detection and add an explicit "did you actually run the build?" prompt to developer.md.

### `missing-environmental-context`

- **Trace signal (script):** `file_edited` records on files matching `**/package.json` or `**/Cargo.toml` within the first 5 events of a run_id: the agent is searching for tool config instead of using the local context block
- **Threshold:** ≥3 runs
- **Root cause:** Agent fails search + discovery, doesn't use LocalContext expansion from project-context-loader.cjs
- **Mitigation:** Verify the local-context block is injected at session start (project-context-loader.cjs). If it is missing, fix the hook.

### `time-budget-exceeded`

- **Trace signal (script):** `session_end` with `duration_seconds > 21600` (6h hard timeout) and no `verdict_written` record in the run
- **Threshold:** ≥1 occurrence (catastrophic — one is enough)
- **Root cause:** Agent ran past the 6h harness wall-clock without completing verification.
- **Mitigation:** Document. Investigate manually — likely a doom loop OR an unrecoverable build error. If recurring, lower iteration cap from 3 to 2.

### `slop-buildup`

- **Trace signal (script):** `verdict_written` with `data.weighted_score < 0.6` and `data.overall` not `PASS`
- **Threshold:** ≥3 runs in last 20
- **Root cause:** Generator producing AI slop (purple gradients, generic copy, stock illustrations).
- **Mitigation:** Verify the rubric anti-pattern lists are loaded (originality and design-quality). Add explicit anti-slop examples to the planner's product spec template.

### `reasoning-budget-mismatch`

- **Trace signal:** `cost_sample` records show high USD per step on TRIVIAL-density runs, OR low USD on COMPLEX-density runs
- **Threshold:** ≥5 runs
- **Root cause:** Wrong density mode for the actual task complexity.
- **Mitigation:** Improve `density-select.sh` heuristics; tighten the model→tier mapping.

## Evaluator and generator patterns

### `self-praise-approval`

- **Trace signal:** `verdict_written` with `overall: PASS` followed by user manual override OR a follow-up plan addressing the same task within 24h
- **Threshold:** ≥2 occurrences
- **Root cause:** Out-of-box Claude as a QA agent identifies legitimate issues, then talks itself into approving them. Leniency drift.
- **Mitigation:** Check that the evaluator's skeptic stance is reloaded per criterion, and strengthen it with more anti-rationalization counters.

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

- **Trace signal:** standard-tier `session_end` records with abnormally low duration and no failure markers
- **Threshold:** N/A, should not appear on the capable tier
- **Root cause:** Model gets anxious about context limits, exits early.
- **Mitigation:** Move to the capable tier. This pattern is the main reason for the LEAN density mode.

## Suggestion Format

When `mk:trace-analyze` emits suggestions, each entry must include (the fields are the same in `references/run-procedure.md`):

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

Each suggestion is presented to the user on its own for approve, modify or reject.

## Adding New Patterns

To add a pattern:

1. Identify a recurring failure in trace-analyze findings (≥3 occurrences across ≥2 runs)
2. Write the trace signal — exact JSONL fields/values to grep for
3. Set frequency threshold (start at 3, raise if false-positives)
4. Document root cause (why this happens)
5. Propose mitigation (which hook/rule/prompt to change)
6. Add the entry to this file
7. If the signal is decidable from record fields, add a detector in `scripts/lib/pattern-detect.cjs`, then re-run `mk:trace-analyze`