---
title: Adaptive Density
description: How the harness scales scaffolding to model capability — the dead-weight thesis and four density tiers.
---

# Adaptive Density

## The Dead-Weight Thesis

Every harness component encodes an assumption about what the model **cannot** do. A sprint contract assumes the model can't self-derive testable criteria. A context reset assumes working memory degrades over long sessions. An iteration loop assumes a single pass misses issues. These assumptions were correct for the models that existed when each component was added.

Models improve. Assumptions age. When a capable model (Opus 4.6+ with 1M context + auto-compaction) is forced through scaffolding designed for a less capable model, the scaffolding stops helping and starts adding noise. Anthropic measured this directly: full harness on Opus 4.6 **degrades** output compared to a leaner config. The model is already handling internally what the scaffolding was built to compensate for — so the scaffolding becomes friction.

Adaptive density operationalizes this finding. The harness checks the model tier and selects the right amount of scaffolding — no more, no less.

## The Four Tiers

This is a simplified view. The canonical decision matrix with per-cell rationale lives at `.claude/skills/meow:harness/references/adaptive-density-matrix.md`.

| Tier | Model | Density | Planner | Contract | Iteration | Context Reset | Rubric |
|---|---|---|---|---|---|---|---|
| TRIVIAL | Haiku | MINIMAL | Skip (use `meow:cook`) | Skip | Skip | Skip | Skip |
| STANDARD | Sonnet | FULL | Product-level | Required | 1–3 rounds | Optional | Full |
| COMPLEX | Opus 4.5 | FULL | Product-level | Required | 2–3 rounds | Required | Full |
| COMPLEX | Opus 4.6+ | LEAN | Product-level | Optional | 0–1 round | Skip | Full |

**MINIMAL (Haiku):** the harness short-circuits immediately to `meow:cook`. Haiku can execute focused tasks but can't drive a multi-hour iteration loop productively. The scaffolding overhead would exceed the value.

**FULL (Sonnet, Opus 4.5):** full pipeline with everything on. Contract required to prevent silent feature substitution. Context resets required for Opus 4.5 because working memory degrades over long sessions. Sonnet benefits from up to 3 iteration rounds.

**LEAN (Opus 4.6+):** the load-bearing finding from Anthropic's research. Single-session build is the default; one iteration round is the recovery option. Contract is optional — skip it when fewer than 5 acceptance criteria are needed. No context reset — auto-compaction handles long-context degradation, and forcing a subagent context reset breaks the model's reasoning continuity.

**Rubric rigor is unchanged across all non-MINIMAL tiers.** LEAN does not lower the quality bar. It lowers the scaffolding needed to clear the bar.

## How It's Selected

`meow:scale-routing` emits a `harness_density` field (`MINIMAL | FULL | LEAN`) based on detected model tier and model string. The resolution order:

1. `MEOWKIT_HARNESS_MODE` env var (highest priority) — `MINIMAL`, `FULL`, or `LEAN`
2. `--tier` flag on `/meow:harness` — `auto`, `minimal`, `full`, `lean`
3. `density-select.sh` auto-detection from model env vars:
   - `MEOWKIT_MODEL_HINT` (explicit override)
   - `CLAUDE_MODEL` (Claude Code legacy)
   - `ANTHROPIC_MODEL` (Anthropic SDK)
   - (none) → defaults to STANDARD tier → FULL density (safe fallback)

The chosen density and its resolution source are logged in the harness run report's "Density Decision" section so you can always audit what fired.

## Auto-Detection Gotcha

**Claude Code does NOT export the model id to hooks.** This is a verified limitation (confirmed against `code.claude.com/docs/en/hooks`, 2026-04-08).

If you're running Opus 4.6 without setting a hint, the harness falls back to `STANDARD → FULL`. You silently get full scaffolding when LEAN would serve you better.

**Fix — set the hint once in your shell:**

```bash
export MEOWKIT_MODEL_HINT=opus-4-6
```

Or pass the flag per-run:

```bash
/meow:harness "build a kanban app" --tier lean
```

Or force it session-wide:

```bash
export MEOWKIT_HARNESS_MODE=LEAN
```

When the fallback fires, the run report records `Source: auto-fallback (no model env var detected)` so you can identify the issue.

## Density Does Not Bypass Gates

`MEOWKIT_HARNESS_MODE=LEAN` adjusts scaffolding — it does NOT lower the quality bar or skip enforcement.

These gates apply regardless of density mode:

1. **Gate 1** — approved plan required before Phase 3 begins
2. **Gate 2** — review verdict required before Phase 5 begins
3. **Contract gate** — if a contract exists, generator must read it before writing source code
4. **Active-verification hard gate** — evaluator must drive the running build; static-only PASS is auto-converted to FAIL

Rule 10 in `.claude/rules/harness-rules.md`: density decides HOW MUCH scaffolding the model needs. It does not lower the bar itself.

## Dead-Weight Audit

On every major model upgrade, run the dead-weight audit playbook. It measures each harness component's actual impact with the new model by comparing benchmark scores with the component enabled vs disabled.

- **Delta ≤ 0:** component is no longer load-bearing → PRUNE candidate
- **0 < Delta < 0.02:** borderline → WATCH, revisit next cycle
- **Delta ≥ 0.02:** load-bearing → KEEP with evidence

The audit exists because "this component helped Opus 4.5" is not evidence it helps Opus 4.6. Every model upgrade is an opportunity to test assumptions.

Full playbook: `docs/dead-weight-audit.md`.

## Canonical Source

`.claude/skills/meow:harness/references/adaptive-density-matrix.md` is the single source of truth. This page embeds a simplified 4-row view; the canonical matrix includes per-cell rationale and anti-patterns.

## Related

- [/guide/harness-architecture](/guide/harness-architecture) — full pipeline context
- [/reference/skills/harness](/reference/skills/harness) — harness skill spec
- [/reference/skills/scale-routing](/reference/skills/scale-routing) — density emission
- [/guide/trace-and-benchmark](/guide/trace-and-benchmark) — dead-weight audit measurement infrastructure
- [/reference/rules-index#harness-rules](/reference/rules-index#harness-rules) — Rule 5 (density), Rule 7 (dead-weight audit), Rule 10 (no gate bypass)
