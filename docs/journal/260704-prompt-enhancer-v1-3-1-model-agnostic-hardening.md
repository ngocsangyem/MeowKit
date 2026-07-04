# Prompt-Enhancer v1.3.1 — Model-Agnostic Hardening

Date: 2026-07-04
Scope: `mk:prompt-enhancer` skill. Phases 1–6 of plan
`plans/260704-1615-prompt-enhancer-improvement-strategy/plan.md`.

## What shipped

Thin improvement (not redesign) on top of an already model-agnostic skill.

- **Compliance fix (Phase 2):** `playbook.md` #8 default fix was model-coupled
  ("For Claude: wrap data in `<context>` tags") — contradicted SKILL.md Hard
  Constraint 4. De-coupled to a neutral `--- DATA START/END ---` fence; XML idiom
  moved to `--analyze` target-notes only. Added portability rationale to HC4.
- **Context-engineering lazy gate (Phase 2):** `context-safeguards.md` §7 —
  recommend `mk:context-engineering` on broad-repo / no-boundary prompts; never
  auto-read. Keeps the default rewrite read-free.
- **Complexity classifier (Phase 3):** new `references/complexity-classifier.md`
  — 10 prompt types → strategy + output length + research framing. Orthogonal to
  flag modes; references (not duplicates) the Freedom-level table.
- **Task recipes + target notes (Phase 4):** `references/task-recipes.md`
  (per-type emphasis maps, role boundary hard) and `references/target-notes.md`
  (annotation-only adapters). Confirmed decision: **no `--target` flag** — target
  notes render only in `--analyze` when the input names a target, never mutate
  the rewrite, silent fallback otherwise.
- **Eval (Phase 5):** 9 new canaries #13–#21 (migration / planning-no-implement /
  debugging-hypothesis / target-Codex / target-silent / VN / mixed-lang /
  context-gate / data-fence). Rubric +2 dims (language, target convergence).
  README 12→21. Version 1.2 → **1.3.1**.
- **Plugin (Phase 6):** regenerated `plugin/skills/prompt-enhancer/` via
  `mewkit build-plugin`.

## Confirmed design decisions (user)

1. `--target` reshape → dropped; target-notes analysis-only.
2. Deep-mode fixture → repo MeowKit (pin sha).
3. Kernel labels stay English; content follows input language.
4. Augment note → copy pattern only, no unverified metrics.

## Difficulties / decisions

- **Pre-existing plugin drift surfaced by build-plugin.** `mewkit build-plugin`
  regenerates the whole `plugin/` tree. It picked up stale diffs for
  `plan-creator`, `context-audit`, `agent-detector`, and a missing
  `context-engineering` plugin dir — all pre-dating this session (their
  `.claude/` sources were edited earlier without regenerating `plugin/`).
  Reverted those to keep this change scoped to prompt-enhancer. **The drift is a
  real repo issue** — a separate `mewkit build-plugin` sync commit is needed.
- **Eval not run.** Suite is manual / LLM-judged. Canaries #13–#21 + a re-run of
  #4 (post playbook-#8 change) are recorded as **PENDING** in
  `baseline-results.md`; NOT marked PASS without an actual fresh-instance run.

## Unresolved questions

- Run #13–#21 + #4 on a fresh instance and record the baseline before declaring
  v1.3.1 rollout-APPROVED.
- Separate task: `mewkit build-plugin` to sync the pre-existing drift for
  plan-creator / context-audit / agent-detector / context-engineering.
- Deep-mode fixture (repo MeowKit) sha not yet pinned in `baseline-results.md`.
