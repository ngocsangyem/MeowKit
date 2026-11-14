# Adaptive Density Matrix

The full decision table for autobuild scaffolding density (`MINIMAL`, `FULL`, `LEAN`) per capability tier. Implements the "dead-weight thesis": capable models need less scaffolding, and over-scaffolding a capable model actively hurts output quality.

**Cursor-specific note:** a Cursor custom agent's `model` field is `inherit` — there is no per-call model-id string this bundle can read at runtime, so density can never auto-detect which underlying model is doing the work. The matrix below still encodes the reasoning-budget tiers (TRIVIAL/STANDARD/COMPLEX), but the tier itself is always set explicitly (task-type default, `--tier` flag, or `MEOWKIT_AUTOBUILD_MODE`) rather than sniffed from a model string. Treat "capable enough for LEAN" as something the user asserts, not something this bundle detects.

## The Matrix

| Tier | Selection Source | Density | Planner | Contract | Iteration Loop | Context Reset | Rubric Rigor |
|---|---|---|---|---|---|---|---|
| **TRIVIAL** | task-type default (quick/typo-level) | `MINIMAL` | Skip (use plan-creator `--fast`) | Skip | Skip | Skip | Skip — invokes `mk:cook` instead |
| **STANDARD** | task-type default (most builds) | `FULL` | `--product-level` | Required | 1–3 rounds | Optional | Full preset |
| **COMPLEX** | task-type default (architecture-heavy) | `FULL` | `--product-level` | Required | 2–3 rounds | **Required** | Full preset |
| **COMPLEX** | explicit `--tier lean` / `MEOWKIT_AUTOBUILD_MODE=LEAN` | **`LEAN`** | `--product-level` | **Optional** (skip if <5 ACs) | 0–1 rounds | **Skip** (auto-compact) | Full preset |

## Per-Cell Rationale

### TRIVIAL → MINIMAL

A trivial task is fast and cheap to scope but doesn't benefit from a multi-hour build harness. Running the full harness on a trivial build wastes scaffolding effort. **Short-circuit:** the harness step-00 detects MINIMAL and immediately delegates to `mk:cook` (the standard single-task pipeline), which is appropriately scoped for trivial work.

### STANDARD → FULL

Standard-tier builds benefit from explicit scaffolding to stay coherent across multi-hour builds. **Why:** the contract gate prevents silent feature substitution and the iteration loop catches self-praise drift. This is the canonical "harness with everything on" mode, and the default for anything not explicitly opted into LEAN.

### COMPLEX (default) → FULL

Complex, architecture-heavy builds still benefit from autobuild scaffolding by default. **Why:** the failure mode at this tier shifts from coherence to ambition — an unscaffolded build tends to under-scope without an explicit contract demanding ambitious AC coverage. Context resets are required because working memory degrades over long sessions regardless of underlying model.

### COMPLEX, explicit opt-in → LEAN

This is the **load-bearing finding** behind the dead-weight thesis, carried over from prior research on highly capable long-context models: a model capable of self-deriving contract criteria from a product spec and driving its own active verification can **degrade when forced through the full harness**, because the scaffolding adds noise the model is already handling internally. Since this bundle cannot detect that capability automatically, LEAN is available only when the user explicitly asserts it via `--tier lean` or `MEOWKIT_AUTOBUILD_MODE=LEAN`.

**Concrete LEAN deltas vs FULL:**
- **Contract: optional.** Skip if estimated ACs < 5. The model can draft + verify its own implicit contract from the product spec.
- **Iteration loop: 0–1 rounds.** Single-pass build is the default; one iteration is the recovery option for catastrophic verdicts.
- **Context reset: skipped.** Trusts the model's own long-context handling rather than forcing a sub-task context reset that would break reasoning continuity.
- **Rubric rigor: unchanged.** The rubric library remains the source of truth. LEAN doesn't lower the bar for output quality; it lowers the bar for HOW MUCH scaffolding the model needs to clear that bar.

## Override Sources

Density resolves via this priority order:

1. **`MEOWKIT_AUTOBUILD_MODE` env var** (highest) — `MINIMAL`, `FULL`, or `LEAN`
2. **`--tier` flag on `the autobuild skill`** — `auto`, `minimal`, `full`, `lean`
3. **`density-select.sh` default** — no model string to read, so this resolves to `STANDARD` tier → `FULL` density (safe fallback) unless a tier was already set above

There is no auto-detection step. A Cursor custom agent's `model` field is `inherit`, and no session env var exposes the underlying model id to this bundle's scripts. Users who know their session is running on a model capable enough for LEAN mode should either:
- Pass `--tier lean` explicitly on the autobuild invocation, OR
- Set `export MEOWKIT_AUTOBUILD_MODE=LEAN` for the session

The chosen density and its source are logged in the run report's "Density Decision" section for audit. When no explicit tier is given, the log records `Source: auto-fallback (no model-id signal available)` so users can identify when they're getting `FULL` instead of an intended `LEAN`.

## When the Matrix Will Need Updating

Per the "dead-weight thesis," every model upgrade is an opportunity to test whether existing scaffolding is still load-bearing. When a materially more capable model becomes available in the IDE:

1. Re-run the calibration set (Phase 8 — `mk:benchmark`) with `--tier full`
2. Re-run the same set with `--tier lean`
3. If LEAN performance matches FULL within 5%, note that the model is a good LEAN candidate for this project
4. If LEAN performance exceeds FULL (faster, cheaper, equivalent quality), prefer LEAN going forward for that model
5. Log the decision (component, tier, density choice, measured delta, audit date) in the dead-weight audit registry per the dead-weight-audit conventions Rule 6

The matrix is **not** static. It encodes the current best understanding of "where does scaffolding stop helping and start hurting?" — and that boundary moves with model capability, even though this bundle cannot observe capability directly.

## Anti-Patterns

| Anti-pattern | Why it's wrong |
|---|---|
| Assuming `--tier lean` is safe for every project because it worked once | LEAN trusts the underlying model to self-verify; a weaker model behind the same Cursor agent will under-scope silently |
| Setting MEOWKIT_AUTOBUILD_MODE=LEAN to "save time" on a standard build | Skipping scaffolding on a model that still needs it produces worse output AND wastes more time on rework |
| Forcing FULL "because more is always safer" | Over-scaffolding a genuinely capable model adds noise instead of value — the whole point of LEAN is avoiding that |
| Skipping the calibration replay after switching models | The whole policy depends on measured performance per tier; skipping is how the matrix becomes dead weight itself |

## See Also

- the dead-weight-audit conventions — audit cadence, measurement, thresholds, never-prune list
- the harness conventions Rule 7 — when the dead-weight audit must be re-run
- `.cursor/skills/scale-routing/SKILL.md` Output Schema v2.1 — `autobuild_density` field
- `.cursor/skills/benchmark/` — calibration replay automation
