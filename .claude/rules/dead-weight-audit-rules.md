# Dead-Weight Audit Rules

These rules govern the periodic audit that keeps the harness pruned across model upgrades. The audit implements the "dead-weight thesis": every harness component encodes an assumption about what the model CANNOT do, and assumptions need stress-testing as models improve.

## Rule 1: When the Audit MUST Run

The dead-weight audit MUST be run on any of the following triggers:

1. **New model release** (Opus / Sonnet / Haiku major or minor version)
2. **Quarterly** regardless of releases — calendar reminder
3. **When `mk:trace-analyze` surfaces a recurring no-value pattern** — a component flagged as "never catches anything" is a prune candidate
4. **When a user reports the harness "feels heavy"** — empirical signal of over-scaffolding

WHY: Model upgrades can turn useful scaffolding into dead weight. Without a forcing function, dead weight accumulates silently and degrades capable models.

## Rule 2: The Audit Is Benchmark-Driven, Not Subjective

The audit MUST use measured benchmark deltas. Subjective "feels heavy" comments trigger the audit, but they do not substitute for the measurement.

Process for each component under test:

1. **Baseline:** run `/mk:benchmark run --full`, capture the run id
2. **Disable** the component (env var flag, comment out hook registration, comment out a rule import)
3. **Re-run** `/mk:benchmark run --full`, capture the disabled run id
4. **Compare:** `/mk:benchmark compare {baseline-run-id} {disabled-run-id}` and read the `measured_delta` field (= `baseline_avg − disabled_avg`)
5. **Re-enable** the disabled component before exiting the audit (non-destructive measurement)

WHY: Vibes-based pruning either keeps dead weight or removes load-bearing components by accident; only measurement is reliable.

## Rule 3: Decision Thresholds

Apply this table to the measured delta:

| Delta | Decision | Action |
|---|---|---|
| ≤ 0 (no regression OR improvement when disabled) | **PRUNE** | Open a removal plan via `mk:plan-creator --hard` |
| 0 < Δ < 0.02 (< 2 points on the 0–1 scale) | **WATCH** | Revisit at the next audit cycle |
| ≥ 0.02 (≥ 2 points) | **KEEP** | Record the delta + model + date as evidence |

WHY: Without an explicit threshold, audits drift toward "keep everything just in case."

## Rule 4: Components That NEVER Prune

The following classes are exempt from pruning regardless of measured delta:

- **Security defenses** (everything in `.claude/rules/security-rules.md` and `.claude/rules/injection-rules.md`)
- **Active-verification hard gate** for the evaluator (per `harness-rules.md` Rule 8)
- **Gate 1 / Gate 2 approval flows** (per `.claude/rules/gate-rules.md`)
- The cost of one bypass exceeds all the misses combined

WHY: Security and gate components protect against catastrophic failure modes that measurement cannot capture. Catch-rate is not the right metric for safety nets.

## Rule 5: Re-Audit Across Two Consecutive Model Versions Before Pruning

A component MUST show delta < 1 point across TWO consecutive model versions before being marked PRUNE. A single low-delta measurement is noise.

WHY: One-shot pruning has a high false-positive rate; consecutive measurements separate signal from noise.

## Rule 6: Registry of Decisions

Every audit cycle MUST write its findings to a versioned registry: component, encoded assumption, measured delta, model version, audit date, decision (PRUNE / WATCH / KEEP). The registry is the source of truth for future audits.

Each new harness component MUST be added to the registry on the same PR that introduces it. Orphan components (no registry entry) become dead weight by default.

WHY: Without a registry, future audits redo work that's already been measured.

## Rule 7: Anti-Patterns

| Anti-pattern | Why it's wrong |
|---|---|
| Pruning a security component because "it never catches anything" | Security defenses MUST stay regardless of measured catch-rate — the cost of one bypass exceeds all the catches |
| Pruning based on subjective "feels heavy" without measured baseline | The whole point of the audit is to replace vibes with measurement |
| Skipping the calibration replay after a model upgrade | The audit IS the upgrade verification — skipping is how the harness becomes dead weight itself |
| Adding new components without a registry entry | Orphans accumulate dead weight by default |
| Running the audit on one synthetic task instead of the calibration set | Single-task results are noise; the calibration set exists for statistical signal |

## Rule 8: Circular-Dependency Workaround

`mk:benchmark` invokes `mk:harness` per canary task. If the bug being audited is IN the harness itself, the audit cannot run end-to-end. Workaround:

1. Bypass `mk:benchmark`. Run individual canary specs via `/mk:cook <spec.md>` directly.
2. Manually score each verdict against the spec's acceptance criteria (binary pass/fail).
3. Aggregate across the 5 quick specs for a baseline average.
4. Disable the suspect component, re-run the same 5 specs, manually score.
5. Compare by hand — same math as `compare-runs.sh`, executed in a notebook or spreadsheet.
6. Annotate the registry's `Measured delta` cell with `(manual)` so future audits know the data point's provenance.

WHY: A broken harness cannot self-test; the manual path keeps the audit possible.

## Applies To

- `.claude/skills/benchmark/` — the measurement runner
- `.claude/skills/harness/` — adaptive-density decisions consume the audit's output
- `.claude/skills/trace-analyze/` — field-data complement to the benchmark
- `.claude/rules/harness-rules.md` Rule 7 — points at this rule for the audit specifics
- Every harness component (per Rule 6, must have a registry entry)
