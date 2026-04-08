# Adaptive Density Matrix

The full decision table for harness scaffolding density (`MINIMAL`, `FULL`, `LEAN`) per model tier × model id. Implements the "dead-weight thesis" from Anthropic's harness research: capable models need less scaffolding, and over-scaffolding capable models actively hurts output quality.

## The Matrix

| Model Tier | Model ID Pattern | Density | Planner | Contract | Iteration Loop | Context Reset | Rubric Rigor |
|---|---|---|---|---|---|---|---|
| **TRIVIAL** | `*haiku*` | `MINIMAL` | Skip (use plan-creator `--fast`) | Skip | Skip | Skip | Skip — invokes `meow:cook` instead |
| **STANDARD** | `*sonnet*` | `FULL` | `--product-level` | Required | 1–3 rounds | Optional | Full preset |
| **COMPLEX** | `opus-4-5`, other Opus | `FULL` | `--product-level` | Required | 2–3 rounds | **Required** | Full preset |
| **COMPLEX** | `opus-4-6`, `opus-4-7`+ | **`LEAN`** | `--product-level` | **Optional** (skip if <5 ACs) | 0–1 rounds | **Skip** (auto-compact) | Full preset |

## Per-Cell Rationale

### TRIVIAL → MINIMAL

Haiku is fast and cheap but limited in reasoning depth. Running the full harness on a Haiku-powered build wastes scaffolding effort because the model can't drive a multi-hour iteration loop productively. **Short-circuit:** the harness step-00 detects MINIMAL and immediately delegates to `meow:cook` (the standard single-task pipeline), which is appropriately scoped for Haiku's strengths.

### STANDARD → FULL

Sonnet has good reasoning but benefits from explicit scaffolding to stay coherent across multi-hour builds. **Why:** Sonnet's context window and reasoning depth need the contract gate to prevent silent feature substitution and the iteration loop to catch self-praise drift. This is the canonical "harness with everything on" mode.

### COMPLEX (Opus 4.5 / older) → FULL

Opus 4.5 is more capable than Sonnet but still benefits from harness scaffolding for autonomous multi-hour builds. **Why:** the failure mode at this tier shifts from coherence to ambition — Opus 4.5 will under-scope without an explicit contract demanding ambitious AC coverage. Context resets are required because the model's working memory degrades over long sessions.

### COMPLEX (Opus 4.6+) → LEAN

This is the **load-bearing finding** of Anthropic's harness research. Opus 4.6 with auto-compaction + 1M context can self-derive contract criteria from a product spec, drives its own active verification, and **degrades when forced through the full harness** because the scaffolding adds noise the model is already handling internally.

**Concrete LEAN deltas vs FULL:**
- **Contract: optional.** Skip if estimated ACs < 5. The model can draft + verify its own implicit contract from the product spec.
- **Iteration loop: 0–1 rounds.** Single-pass build is the default; one iteration is the recovery option for catastrophic verdicts.
- **Context reset: skipped.** Auto-compaction handles long-context degradation natively. Forcing a subagent context reset breaks the model's reasoning continuity.
- **Rubric rigor: unchanged.** The rubric library remains the source of truth. LEAN doesn't lower the bar for output quality; it lowers the bar for HOW MUCH scaffolding the model needs to clear that bar.

## Override Sources

Density resolves via this priority order:

1. **`MEOWKIT_HARNESS_MODE` env var** (highest) — `MINIMAL`, `FULL`, or `LEAN`
2. **`--tier` flag on `/meow:harness`** — `auto`, `minimal`, `full`, `lean`
3. **`density-select.sh` auto-detection** from model env vars (lowest)

The auto-detection step tries these env vars in order and uses the first set:

1. `MEOWKIT_MODEL_HINT` (explicit override)
2. `CLAUDE_MODEL` (Claude Code legacy)
3. `ANTHROPIC_MODEL` (Anthropic SDK)
4. (none) → defaults to `STANDARD` tier → `FULL` density (safe fallback)

**Known limitation:** Claude Code does not always export a model id env var to subagent contexts. Users running `/meow:harness` on Opus 4.6 who want LEAN mode should either:
- Set `export MEOWKIT_MODEL_HINT=opus-4-6` once in their shell, OR
- Pass `--tier lean` explicitly on the harness invocation, OR
- Set `export MEOWKIT_HARNESS_MODE=LEAN` for the session

The chosen density and its source are logged in the run report's "Density Decision" section for audit. If auto-detection used the safe fallback, the log records `Source: auto-fallback (no model env var detected)` so users can identify when they're getting `FULL` instead of the expected `LEAN`.

## When the Matrix Will Need Updating

Per the "dead-weight thesis," every model upgrade is an opportunity to test whether existing scaffolding is still load-bearing. When a new model tier rolls out (Sonnet 4.6, Opus 4.7, Haiku 5.x):

1. Re-run the calibration set (Phase 8 — `meow:benchmark`) with the new model on FULL density
2. Re-run the same set on LEAN density
3. If LEAN performance matches FULL within 5%, downgrade the tier's matrix entry from FULL to LEAN
4. If LEAN performance exceeds FULL (faster, cheaper, equivalent quality), upgrade aggressively
5. Log the decision in `docs/dead-weight-audit.md` (Phase 6 deliverable)

The matrix is **not** static. It encodes the current best understanding of "where does scaffolding stop helping and start hurting?" — and that boundary moves with model capability.

## Anti-Patterns

| Anti-pattern | Why it's wrong |
|---|---|
| Hardcoding LEAN for all Opus models | Opus 4.5 still benefits from FULL — only 4.6+ has the auto-compaction + 1M context that justifies LEAN |
| Setting MEOWKIT_HARNESS_MODE=LEAN to "save time" on Sonnet | Sonnet without scaffolding produces worse output AND wastes more time on rework |
| Forcing FULL on Opus 4.6 because "more is safer" | False — over-scaffolding capable models adds noise. Anthropic's measured finding |
| Skipping the calibration replay after a model upgrade | The whole policy depends on measured performance per tier; skipping is how the matrix becomes dead weight itself |

## See Also

- `meowkit/docs/dead-weight-audit.md` (Phase 6 — pending)
- `meowkit/.claude/skills/meow:scale-routing/SKILL.md` Output Schema v2.1 — `harness_density` field
- `meowkit/.claude/skills/meow:benchmark/` (Phase 8 — pending) — calibration replay automation
- Anthropic harness design article (Prithvi Rajasekaran, Labs)
