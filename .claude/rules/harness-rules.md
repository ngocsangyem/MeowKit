# Harness Rules

These rules govern the autonomous multi-hour build pipeline (`meow:harness`) and the generator/evaluator architecture introduced by the harness plan (Phases 1–5).

## Rule 1: Planner Stays Product-Level

The planner agent in product-level mode (`meow:plan-creator --product-level`) MUST produce user stories, features, and design language — NOT file paths, class names, schemas, or step-by-step code instructions.

**WHY:** Anthropic harness research found that capable models (Opus 4.5+) under-perform when locked into pre-sharded implementation tasks. Micro-sharding the plan causes cascading errors — the model loses room to discover better solutions. The planner's job is to set ambition; the generator's job is to find the path.

**INSTEAD of:** "Write `src/auth/login.ts` with a `LoginController` class that has a `loginUser(email: string, password: string)` method"
**USE:** "As a returning user, I want to log in with my email and password so that I can access my saved work."

## Rule 2: Generator ≠ Evaluator (Hard Separation)

The generator (developer agent) and evaluator (evaluator agent) are distinct subagents with isolated contexts. Self-evaluation is forbidden.

**WHY:** Out-of-box Claude has a measurable leniency drift when grading its own output — it identifies legitimate issues, then talks itself into deciding they weren't a big deal. An external evaluator with a skeptic persona is the only known mitigation. See `.claude/agents/evaluator.md` and research-01 §6.

**INSTEAD of:** generator says "PASS" → ship
**USE:** generator → handoff → evaluator (fresh context) → graded verdict with evidence → ship/loop

## Rule 3: Sprint Contract Required in FULL Density; Optional in LEAN; Skipped in MINIMAL

Per the adaptive density policy (`meow:harness/references/adaptive-density-matrix.md`):

- `MINIMAL` (Haiku) — contract skipped (harness short-circuits to `meow:cook`)
- `FULL` (Sonnet, Opus 4.5) — contract REQUIRED before any source-code edit; enforced by `gate-enforcement.sh`
- `LEAN` (Opus 4.6+) — contract OPTIONAL; skip if estimated ACs < 5

**WHY:** Contract negotiation is dead weight on TRIVIAL tier and on capable models that can self-derive testable criteria from a product spec. It's load-bearing on intermediate tiers where the model needs explicit scope to prevent silent feature substitution.

## Rule 4: Iteration Cap = 3 Rounds Before Escalation

The harness iteration loop (generator ⇄ evaluator) is capped at 3 rounds by default (configurable via `--max-iter`). After round 3, the harness escalates to a human via `AskUserQuestion`.

**WHY:** Agents that can't converge in 3 rounds won't converge in 5 — the failure mode is deeper than iteration count. Forcing more rounds wastes budget and erodes trust in the verdict. Human escalation breaks ties.

## Rule 5: Adaptive Density Decided by `meow:scale-routing` + Model String

The harness scaffolding density (`MINIMAL | FULL | LEAN`) is selected by `meow:scale-routing` based on the detected model tier and model id. The decision matrix is the single source of truth at `.claude/skills/meow:harness/references/adaptive-density-matrix.md`.

**WHY:** Capable models (Opus 4.6+ with auto-compaction + 1M context) **degrade** when forced through full harness scaffolding — Anthropic's measured "dead-weight thesis" finding. The density policy operationalizes this without manual ceremony.

**Override:** `MEOWKIT_HARNESS_MODE=MINIMAL|FULL|LEAN` env var overrides auto-detection. Logged in the harness run report.

## Rule 6: Budget Thresholds — Warn at $30, Approve at $100, Hard Block at User Cap

The harness budget tracker (`meow:harness/scripts/budget-tracker.sh`) enforces three thresholds:

- **$30 warn** — print warning, continue
- **$100 hard block** — halt the run, set `final_status=TIMED_OUT`
- **User cap** (`MEOWKIT_BUDGET_CAP` env var or `--budget` flag) — overrides hard block, can be lower OR higher

**WHY:** Multi-hour autonomous runs can rack up cost faster than humans notice. The 3-tier threshold (warn, hard, user) catches both runaway runs and intentional high-budget research.

## Rule 7: Dead-Weight Audit Mandatory on Model Upgrade

Every harness component encodes an assumption about what the model CANNOT do. When a new model tier ships (e.g., Sonnet 4.6, Opus 4.7), the dead-weight audit playbook (`docs/dead-weight-audit.md`) MUST be run to verify each component is still load-bearing.

**WHY:** Per the dead-weight thesis, scaffolding that helped Opus 4.5 may hurt Opus 4.7. Components that don't pay their measured-delta keep are dead weight.

**Detection:** `post-session.sh` attempts to flag this via `MEOWKIT_MODEL_HINT` env var, but Claude Code does NOT export `CLAUDE_MODEL` to hooks (verified 260408). Auto-detection only works if the user sets `export MEOWKIT_MODEL_HINT=opus-4-7` at session start. Otherwise the audit must be triggered manually on a calendar reminder OR by reading session metadata from `~/.claude/projects/`.

**INSTEAD of:** assuming the harness still works after a model upgrade
**USE:** the audit playbook with measured baselines (calendar reminder if no model hint set)

## Rule 8: Active Verification Is a HARD GATE

The evaluator (Phase 3) MUST drive the running build via active verification — browser navigation, curl, CLI invocation. Static-analysis-only verdicts are forbidden. `validate-verdict.sh` rejects PASS verdicts with empty `evidence/` directories and converts them to FAIL.

**WHY:** Tests can pass against mocks while the real endpoint returns 500. Without active verification, the evaluator grades paper. Anthropic's research and our own audit confirmed: 4.5 of 6 red-team scenarios slip past static analysis.

## Rule 9: Skeptic Persona Reloaded Per Criterion

The evaluator MUST re-anchor its skeptic persona (`meow:evaluate/prompts/skeptic-persona.md`) before grading each criterion. Leniency drift accumulates over a session.

**WHY:** Out-of-box Claude as a QA agent identifies legitimate issues, then talks itself into accepting them. Re-anchoring the persona is the cheapest mitigation. Reloading is not optional — it's a checkpoint.

## Rule 10: No Density Override Bypasses Gates

`MEOWKIT_HARNESS_MODE=LEAN` and any `--tier` flag override scaffolding density, NOT gates. Gate 1 (plan), Gate 2 (review verdict), the contract gate (Phase 4), and the active-verification HARD GATE all still apply regardless of density mode.

**WHY:** Density decides HOW MUCH scaffolding the model needs to clear the quality bar. It does not lower the bar.

## Rule 11: Context Caching via Conversation Summary (Phase 9 — 260408)

Long sessions MUST use the conversation summary cache (`.claude/hooks/conversation-summary-cache.sh`) to avoid re-reading the full transcript on every turn. The hook fires on `Stop` (summarize) and `UserPromptSubmit` (inject) and is throttled by transcript size, turn gap, and growth delta.

**WHY:** Re-reading the full transcript on every turn burns ~48KB of context per injection in mid-to-long sessions. A Haiku-summarized cache costs ~$0.01–$0.02 per long session and preserves the same continuity. Claude Code's built-in auto-compaction is opaque, fires late, and produces no inspectable artifact — the explicit cache fires proactively and writes a human-editable markdown file.

**Throttle defaults (Q7):** size > `${MEOWKIT_SUMMARY_THRESHOLD:-20480}` bytes AND (turn delta ≥ `${MEOWKIT_SUMMARY_TURN_GAP:-5}` OR growth ≥ `${MEOWKIT_SUMMARY_GROWTH_DELTA:-5120}` bytes).

**Opt-out:** `MEOWKIT_SUMMARY_CACHE=off` cleanly disables both paths. Graceful degradation: if `claude` CLI is missing or summarization fails, the hook exits 0 silently and the session proceeds with full transcript.

**Security:** the summary is DATA per `injection-rules.md`. Output is secret-scrubbed via `lib/secret-scrub.sh` before writing to cache. The prompt template forbids instruction-shaped content in the summary body.
