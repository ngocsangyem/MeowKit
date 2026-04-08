# Dead-Weight Audit Playbook

The audit playbook for keeping the harness pruned across model upgrades. Implements the "dead-weight thesis" from Anthropic's harness research: every harness component encodes an assumption about what the model CANNOT do, and assumptions need stress-testing as models improve.

## When to Run

- **Every new model release** (Opus / Sonnet / Haiku major version) — **manual trigger required by default.** `post-session.sh` attempts to detect model changes via the `MEOWKIT_MODEL_HINT` env var, but Claude Code does NOT export `CLAUDE_MODEL` or `ANTHROPIC_MODEL` to hooks (verified against `code.claude.com/docs/en/hooks` 260408). Auto-detection only fires if the user sets `export MEOWKIT_MODEL_HINT=opus-4-7` at session start. Without that, the audit is triggered by calendar reminder or by reading `~/.claude/projects/*/session.jsonl` to identify the active model id.
- **Quarterly** regardless of releases — calendar reminder, manual trigger
- **When `meow:trace-analyze` (Phase 8) surfaces a recurring no-value pattern** — a component flagged as "never catches anything" is a prune candidate
- **When a user reports the harness "feels heavy"** — empirical signal of over-scaffolding

## Process (Benchmark-Driven, per Phase 8)

1. **List components.** Refer to the Assumption Registry below. Each component has an encoded assumption.
2. **Run baseline.** Execute `meow:benchmark run` (Phase 8) with ALL components enabled. Record the baseline score.
3. **For each component:**
   - Temporarily disable (env var flag, comment out hook registration, or `--skip-component` flag)
   - Run `meow:benchmark run` again
   - Record component-disabled score in the registry's `measured_delta` column
4. **Decide:**
   - **Delta ≤ 0** (no regression OR improvement when disabled) → mark **PRUNE**; open removal plan
   - **Delta < 2 points** → mark **WATCH**; revisit next audit
   - **Delta ≥ 2 points** → mark **KEEP** with evidence
5. **Update** the registry's `last_measured` column with the date + model version.
6. **File follow-up plan** for any PRUNE items via `meow:plan-creator --hard "remove dead-weight component X"`.

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

> **Audit maturity:** the registry below was seeded at Phase 6 landing (260408). The `First listed` column records when each component first appeared in the registry, NOT when it was empirically measured. The `Measured delta` column is `TBD` for every row because Phase 8 (`meow:benchmark`) hasn't shipped yet — there is no baseline. **Do not interpret current registry rows as "verified" — they are placeholders awaiting measurement.** A future audit cycle (after Phase 8) will populate the deltas and convert TBDs to real numbers.

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
