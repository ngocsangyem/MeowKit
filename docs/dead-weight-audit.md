# Dead-Weight Audit Playbook

The audit playbook for keeping the harness pruned across model upgrades. Implements the "dead-weight thesis" from Anthropic's harness research: every harness component encodes an assumption about what the model CANNOT do, and assumptions need stress-testing as models improve.

## When to Run

- **Every new model release** (Opus / Sonnet / Haiku major version) — **manual trigger required by default.** `post-session.sh` attempts to detect model changes via the `MEOWKIT_MODEL_HINT` env var, but Claude Code does NOT export `CLAUDE_MODEL` or `ANTHROPIC_MODEL` to hooks (verified against `code.claude.com/docs/en/hooks` 260408). Auto-detection only fires if the user sets `export MEOWKIT_MODEL_HINT=opus-4-7` at session start. Without that, the audit is triggered by calendar reminder or by reading `~/.claude/projects/*/session.jsonl` to identify the active model id.
- **Quarterly** regardless of releases — calendar reminder, manual trigger
- **When `meow:trace-analyze` (Phase 8) surfaces a recurring no-value pattern** — a component flagged as "never catches anything" is a prune candidate
- **When a user reports the harness "feels heavy"** — empirical signal of over-scaffolding

## Process (Benchmark-Driven, Phase 8 SHIPPED 260408)

Phase 8 (`meow:benchmark` + `meow:trace-analyze`) ships the measurement infrastructure. The audit now uses real benchmark deltas instead of TBD placeholders.

1. **List components.** Refer to the Assumption Registry below.
2. **Establish baseline:**
   ```bash
   /meow:benchmark run --full
   # Capture run-id from output
   ```
3. **For each component to test:**
   - Disable (env var flag like `MEOWKIT_BUILD_VERIFY=off`, comment out hook registration in `settings.json`, or comment out a rule import)
   - Re-run: `/meow:benchmark run --full`
   - Capture the disabled run-id
4. **Compare and compute delta:**
   ```bash
   /meow:benchmark compare {baseline-run-id} {disabled-run-id}
   ```
5. **Decide based on `measured_delta` (= `baseline_avg - disabled_avg`):**
   - **Delta ≤ 0** (no regression OR improvement when disabled) → mark **PRUNE**; open removal plan
   - **0 < Delta < 0.02** (< 2 points on 0-1 scale) → mark **WATCH**; revisit next audit
   - **Delta ≥ 0.02** (≥ 2 points) → mark **KEEP** with evidence
6. **Update the registry below** with measured delta + audit date + model version.
7. **File follow-up plan** for PRUNE items via `meow:plan-creator --hard`.
8. **Re-enable disabled components** before exiting the audit (non-destructive measurement).

Optionally, also run `/meow:trace-analyze --runs 20` to identify failure patterns from real session traces — this complements the benchmark with field data.

## Pruning Criteria

A component is a **prune candidate** if any of these are true:

- Measured delta ≤ 0 against current model
- Measured delta < 1 across two consecutive model versions
- Component has not caught any failure in the last 100 harness runs (per trace analysis)
- The user explicitly says it gets in the way

A component is **load-bearing** (do NOT prune) if any of these are true:

- Measured delta ≥ 2 points against current model
- Component is the only mitigation for a known failure mode (e.g., active-verification HARD GATE for "tests pass against mocks")
- Component is a security or injection defense (those NEVER prune regardless of measured value)

## PR Template for Pruning

```markdown
## Dead-Weight Prune: <component>

### Component
- Path: <file>
- Function: <what it does>

### Encoded Assumption
"<the assumption this component implements>"

### Measured Delta
- Baseline (component enabled): <score>
- Disabled: <score>
- Delta: <number> (target: ≤ 0 for prune)
- Model: <model id> at <date>
- Calibration set: <which one>

### Decision
PRUNE — assumption no longer holds for this model tier.

### Removal Plan
- [ ] Delete file(s): <list>
- [ ] Update RULES_INDEX.md (if rule)
- [ ] Update SKILLS_INDEX.md (if skill)
- [ ] Update CLAUDE.md if referenced
- [ ] Re-run benchmark on the pruned harness — must match baseline within 1 point

### Rollback
If a future model regresses, restore from git history at SHA <sha>.
```

## Assumption Registry

Every harness component, its assumption, and current status. Updated per audit cycle.

> **Audit maturity:** the registry below was seeded at Phase 6 landing (260408). The `First listed` column records when each component first appeared in the registry. Phase 8 has now SHIPPED `meow:benchmark` + `meow:trace-analyze`, so the `Measured delta` column can be populated by running the audit playbook above. **Current TBD values mean "no audit cycle has run yet on this component," NOT "Phase 8 unshipped."** The first audit cycle will replace TBDs with real numbers.

## When the Harness Is Broken (Circular Dep Workaround)

`meow:benchmark` invokes `meow:harness` per canary task. If the bug being audited is IN the harness itself (deadlocked iteration loop, broken contract gate, etc.), the audit can't run end-to-end. Workaround:

1. **Bypass `meow:benchmark`.** Run individual canary specs through `meow:cook` directly:
   ```bash
   /meow:cook .claude/benchmarks/canary/quick/01-react-component-spec.md
   ```
2. **Manually score** the verdict against the spec's acceptance criteria (binary pass/fail).
3. **Aggregate** across the 5 quick specs to compute a baseline average.
4. **Disable the suspect component** (env var, comment out hook registration, comment out rule import), re-run the same 5 specs, manually score.
5. **Compare by hand** — the math matches `compare-runs.sh` output, just executed in a notebook or spreadsheet.
6. **Annotate** the registry's `Measured delta` cell with `(manual)` so future audits know the data point's provenance.

This is slower than the automated path but works when the harness is broken.

| Component | Encoded Assumption | First listed | Measured delta | Tier (keep / prune / watch) |
|---|---|---|---|---|
| Sprint contract | Model can't self-derive testable criteria from product spec | 2026-04 (Opus 4.6) | TBD (run baseline) | LEAN: prune; FULL: keep |
| Context reset (subagent dispatch) | Model loses coherence > 2h | 2026-04 (Opus 4.6) | TBD | LEAN: prune; FULL: keep |
| Generator self-eval checklist | Model handoffs optimistic stubs without checking | 2026-04 (Opus 4.6) | TBD | Keep (cheap, catches 20%+) |
| Rubric few-shot anchors | LLM judge drifts without anchors | 2026-04 | TBD | Keep (calibration critical) |
| Iteration loop (3 rounds) | Single-pass evaluator misses issues | 2026-04 | TBD | Keep (max 3 rounds) |
| Sprint decomposition | Model can't hold multi-sprint state | 2026-04 (Opus 4.6) | TBD | LEAN: prune; FULL: keep |
| Red team (plan-creator) | Planner produces shallow plans | 2026-04 | TBD | Keep (high value for `--hard`) |
| Scout (pre-review) | Reviewer misses edge cases | 2026-04 | TBD | Keep |
| Active-verification HARD GATE (evaluator) | Model marks PASS without running the build | 2026-04 | KEEP regardless of delta | NEVER prune (security-class) |
| Skeptic persona (evaluator) | Model drifts to leniency over a session | 2026-04 | TBD | Keep expected (cheap) |
| Build-Verify middleware (Phase 7) | Agent writes code, declares it good, stops | 2026-04 | TBD (LangChain measured +10.8 pts) | Keep expected |
| LoopDetection middleware (Phase 7) | Agent doom-loops on same file | 2026-04 | TBD | Keep expected |
| PreCompletion middleware (Phase 7) | Agent exits without verification | 2026-04 | TBD | Keep expected |
| LocalContext middleware (Phase 7) | Agent lacks env awareness at session start | 2026-04 | TBD | Keep expected |
| Conversation summary cache (Phase 9) | Repeated context replays waste tokens | 2026-04 | TBD (~$0.01/session, ~48KB/turn savings) | Keep expected |

## Anti-Patterns

| Anti-pattern | Why it's wrong |
|---|---|
| Pruning a security component because "it never catches anything" | Security defenses MUST stay regardless of measured catch-rate — the cost of one bypass exceeds all the catches |
| Pruning based on subjective "feels heavy" without measured baseline | The whole point of the audit is to replace vibes with measurement |
| Skipping the calibration replay after a model upgrade | The audit IS the upgrade verification — skipping is how the harness becomes dead weight itself |
| Adding new components without an entry in this registry | Components without registry entries become orphans; they accumulate dead weight by default |
| Running the audit on one synthetic task instead of the calibration set | Single-task results are noise; the calibration set exists for statistical signal |

## See Also

- `.claude/skills/meow:harness/references/adaptive-density-matrix.md` — per-tier density decisions (the audit's siblings)
- `.claude/skills/meow:benchmark/` (Phase 8 — pending) — automated baseline + replay
- `.claude/memory/lessons.md` — where `post-session.sh` writes the audit-needed flag
- Anthropic harness design article (Prithvi Rajasekaran, Labs)
