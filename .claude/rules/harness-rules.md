# Harness Rules

These rules govern the autonomous multi-hour build pipeline (`mk:autobuild`) and the generator/evaluator architecture introduced by the harness plan (Phases 1–5).

## Rule 1: Planner Stays Product-Level

The planner agent in product-level mode (`mk:plan-creator --product-level`) MUST produce user stories, features, and design language — NOT file paths, class names, schemas, or step-by-step code instructions.

**WHY:** Micro-sharded plans reduce capable-model solution search; planner sets ambition, generator finds the path.

Use product stories like "As a returning user, I want to log in with my email and password so that I can access my saved work."

## Rule 2: Generator ≠ Evaluator (Hard Separation)

The generator (developer agent) and evaluator (evaluator agent) are distinct subagents with isolated contexts. Self-evaluation is forbidden.

**WHY:** Self-evaluation drifts lenient; an isolated skeptic evaluator mitigates it.

Flow: generator → handoff → evaluator fresh context → graded verdict with evidence → ship/loop.

## Rule 3: Sprint Contract Required in FULL Density; Optional in LEAN; Skipped in MINIMAL

Per the adaptive density policy (`.claude/skills/autobuild/references/adaptive-density-matrix.md`):

- `MINIMAL` (Haiku) — contract skipped (harness short-circuits to `mk:cook`)
- `FULL` (Sonnet, Opus 4.5) — contract REQUIRED before any source-code edit; enforced by `gate-enforcement.sh`
- `LEAN` (Opus 4.6+) — contract OPTIONAL; skip if estimated ACs < 5

**WHY:** Contracts prevent silent substitution on intermediate tiers but add dead weight on trivial/capable tiers.

## Rule 4: Iteration Cap = 3 Rounds Before Escalation

The harness iteration loop (generator ⇄ evaluator) is capped at 3 rounds by default (configurable via `--max-iter`). After round 3, the harness escalates to a human via `AskUserQuestion`.

**WHY:** Non-convergence after 3 rounds usually needs human judgment, not more budget.

## Rule 5: Adaptive Density Decided by `mk:scale-routing` + Model String

The harness scaffolding density (`MINIMAL | FULL | LEAN`) is selected by `mk:scale-routing` based on the detected model tier and model id. The decision matrix is the single source of truth at `.claude/skills/autobuild/references/adaptive-density-matrix.md`.

**WHY:** Dead-weight thesis — over-scaffolding degrades capable models.

**Override:** `MEOWKIT_AUTOBUILD_MODE=MINIMAL|FULL|LEAN` overrides auto-detection and is logged.

## Rule 6: Budget Thresholds — Warn at $30, Approve at $100, Hard Block at User Cap

The harness budget tracker (`mk:autobuild/scripts/budget-tracker.sh`) enforces three thresholds:

- **$30 warn** — print warning, continue
- **$100 hard block** — halt the run, set `final_status=TIMED_OUT`
- **User cap** (`MEOWKIT_BUDGET_CAP` env var or `--budget` flag) — overrides hard block, can be lower OR higher

**WHY:** Multi-hour runs can spend quickly; thresholds catch runaway and intentional high-budget runs.

## Rule 7: Dead-Weight Audit Mandatory on Model Upgrade

Every harness component encodes an assumption about what the model CANNOT do. When a new model tier ships (e.g., Sonnet 4.6, Opus 4.7), the dead-weight audit MUST be run to verify each component is still load-bearing. The audit's cadence, measurement procedure, decision thresholds, and never-prune list are in `.claude/rules/dead-weight-audit-rules.md`.

**WHY:** Model upgrades can turn useful scaffolding into dead weight.

**Detection:** `post-session.sh` attempts to flag this via `MEOWKIT_MODEL_HINT` env var, but on Claude Code, `CLAUDE_MODEL` is NOT exported to hooks (verified 260408). Auto-detection only works if the user sets `export MEOWKIT_MODEL_HINT=opus-4-7` at session start. Otherwise the audit must be triggered manually on a calendar reminder OR by reading session metadata from `~/.claude/projects/`.

Use the audit playbook with measured baselines after model upgrades.

## Rule 8: Active Verification Is a HARD GATE

The evaluator (Phase 3) MUST drive the running build via active verification — browser navigation, curl, CLI invocation. Static-analysis-only verdicts are forbidden. `validate-verdict.sh` rejects PASS verdicts with empty `evidence/` directories and converts them to FAIL.

**WHY:** Static checks miss real runtime failures; evaluator evidence must exercise the artifact.

## Rule 9: Skeptic Persona Reloaded Per Criterion

The evaluator MUST re-anchor its skeptic persona (`mk:evaluate/prompts/skeptic-persona.md`) before grading each criterion. Leniency drift accumulates over a session.

**WHY:** Persona re-anchoring prevents leniency drift during long grading sessions.

## Rule 10: No Density Override Bypasses Gates

`MEOWKIT_AUTOBUILD_MODE=LEAN` and any `--tier` flag override scaffolding density, NOT gates. Gate 1 (plan), Gate 2 (review verdict), the contract gate (Phase 4), and the active-verification HARD GATE all still apply regardless of density mode.

**WHY:** Density changes scaffolding amount, not the quality bar.
