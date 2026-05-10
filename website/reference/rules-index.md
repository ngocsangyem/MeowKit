---
title: Rules Index
description: "All 19 MeowKit enforcement rules with priority, mechanism, and override conditions."
---

# Rules Index

Rules are loaded at session start. All mandatory unless marked `[CONTEXTUAL]`.

Source file: `docs/rules-index.md`

## Rules

| Rule | Purpose | Source | Applies to |
|------|---------|--------|-----------|
| `security-rules.md` | Block hardcoded secrets, any types, SQL injection, XSS patterns | MeowKit original | All modes, all phases |
| `injection-rules.md` | Prompt injection defense: DATA vs INSTRUCTIONS boundary | MeowKit original | All modes, all phases |
| `gate-rules.md` | Gate 1 (plan approval) and Gate 2 (review approval) hard stops | MeowKit original | Phases 1, 4 |
| `harness-rules.md` | Generator/evaluator architecture: planner stance, contract discipline, evaluator skepticism, iteration limits, adaptive density, dead-weight audit | New (Anthropic + LangChain harness research) | Phase 3 (Build, harness), Phase 4 (Review) |
| `rubric-rules.md` | Evaluator calibration discipline, rubric library governance, anchor balance, drift detection, anti-slop enforcement | New (Anthropic harness research) | Phase 4 (Review, evaluator) |
| `core-behaviors.md` | 6 mandatory operating behaviors: Surface Assumptions, Manage Confusion, Push Back, Enforce Simplicity, Scope Discipline, Verify Don't Assume + 10 failure modes | Adapted from agent-skills | All modes, all phases |
| `tdd-rules.md` | TDD enforcement (opt-in via `--tdd` / `MEOWKIT_TDD=1`); MICRO-TASK exemption included | MeowKit original | Phases 2, 3 **when TDD enabled** [CONTEXTUAL] |
| `agent-conduct.md` | File naming, response structure, context ordering, search-before-building, plan resumption, context hygiene, subagent status protocol | MeowKit original + Claude Code best practices | Implementation, review, all agent responses |
| `development-rules.md` | Skill activation, YAGNI/KISS/DRY, file management, code quality, validation commands, pre-commit, git safety, docs impact | User rules + MeowKit | Implementation, commit |
| `orchestration-rules.md` | Subagent delegation, work/report/plan paths, file ownership, parallel vs sequential, completion-status handling | User rules + MeowKit | Multi-agent `[CONTEXTUAL]` |
| `model-selection-rules.md` | Task type → model tier routing, security escalation | Prompting best practices | Phase 0 (Orient) |
| `scale-adaptive-rules.md` | Domain complexity routing, CSV override, one-shot bypass | BMAD-inspired | Phase 0 (Orient) |
| `step-file-rules.md` | JIT step loading, no skipping, state persistence | BMAD-inspired | Step-file skills |
| `parallel-execution-rules.md` | Worktree isolation, max 3 agents, integration test, opt-in team coordination | MeowKit team pattern | Parallel execution `[CONTEXTUAL]` |
| `skill-authoring-rules.md` | Gotchas, persistent state, SKILL.md line caps, discovery frontmatter, command-vs-skill distinctions | Anthropic skill docs + MeowKit | Skill authoring |
| `post-phase-delegation.md` | Project-manager fire points, skip conditions, invocation form | MeowKit original | Orchestration skills `[CONTEXTUAL]` |
| `agent-routing.md` | Agent phase routing, domain integration hubs, MeowKit skill routing | MeowKit original | Phase 0 |
| `phase-contracts.md` | Phase input/output contract table | MeowKit original | Phases 1-6 |
| `risk-checklist.md` | Horizontal risk flags feeding model escalation | MeowKit original | Phase 0 |

## Loading Priority

Higher number = stronger override:

1. `security-rules.md` — NEVER override
2. `injection-rules.md` — NEVER override
3. `gate-rules.md` — NEVER override (except `/mk:fix` simple)
4. `harness-rules.md` — NEVER override gates; density choice does not bypass any gate
5. `rubric-rules.md` — NEVER override hard-fail propagation
6. `core-behaviors.md` — always apply (6 behaviors + 10 failure modes)
7. `tdd-rules.md` — applies only when `MEOWKIT_TDD=1` / `--tdd`
8. `agent-conduct.md` — always apply
9. `development-rules.md` — always apply
10. `step-file-rules.md` — apply when executing step-file workflows
11. `model-selection-rules.md` — always apply
12. `skill-authoring-rules.md` — apply during skill authoring
13. `scale-adaptive-rules.md` — always apply at Phase 0
14. `risk-checklist.md` — always apply at Phase 0
15. `parallel-execution-rules.md` — apply during parallel execution `[CONTEXTUAL]`
16. `orchestration-rules.md` — apply in multi-agent workflows `[CONTEXTUAL]`
17. `post-phase-delegation.md` — apply during orchestration-skill execution `[CONTEXTUAL]`

## Enforcement Mechanism Matrix

<span class="vp-badge info">v1.1.0</span>

| Rule | Mechanism | Override? | Exception |
|------|-----------|-----------|-----------|
| `security-rules.md` | Behavioral | NEVER | Human override only |
| `injection-rules.md` | Behavioral | NEVER | Human override only |
| `gate-rules.md` | Hook | NEVER | `/mk:fix` simple; scale-routing one-shot |
| `harness-rules.md` | Behavioral + Hook (`gate-enforcement.sh`, `validate-verdict.sh`) | NEVER override gates | Density modes adjust scaffolding, not gate semantics |
| `rubric-rules.md` | Behavioral + Script (`validate-rubric.sh`) | NEVER override hard-fail propagation | Custom rubrics addable; semantics fixed |
| `core-behaviors.md` | Behavioral | No | — |
| `tdd-rules.md` | Behavioral | Yes | Default OFF; opt in via `--tdd` / `MEOWKIT_TDD=1` |
| `agent-conduct.md` | Behavioral | No | Tier A preserves rationale; Tier B includes context hygiene |
| `development-rules.md` | Behavioral | No | — |
| `orchestration-rules.md` | Behavioral | N/A | `[CONTEXTUAL]` |
| `model-selection-rules.md` | Behavioral | No | Domain override via CSV |
| `scale-adaptive-rules.md` | Behavioral + Data | No | CSV user-extensible |
| `risk-checklist.md` | Behavioral + Data | No | Flags route through `model-selection-rules.md` |
| `step-file-rules.md` | Behavioral | N/A | Step-file skills only |
| `parallel-execution-rules.md` | Behavioral + Worktree | N/A | `[CONTEXTUAL]` |
| `skill-authoring-rules.md` | Behavioral + Script | No | MeowKit internal infra paths exempt from persistent-state rule |
| `post-phase-delegation.md` | Behavioral | N/A | `MEOWKIT_PM_AUTO=off` disables silent fires |

**Mechanism types:**
- **Behavioral** — Agent follows rules via system prompt
- **Hook** — Shell script intercepts tool calls before execution
- **Data** — External file (CSV, JSON) drives decisions

## Hook Enforcement

| Hook | Event | Purpose |
|------|-------|---------|
| `privacy-block.sh` | PreToolUse | Block reads of `.env`, `*.key`, credentials |
| `gate-enforcement.sh` | PreToolUse | Block source code writes before Gate 1 |
| `project-context-loader.sh` | SessionStart | Auto-load `project-context.md` |

Rules define _why_. Hooks enforce _what_.

## harness-rules.md {#harness-rules}

Discipline rules for the autonomous multi-hour build pipeline (`mk:harness`) and the generator/evaluator architecture.

| # | Rule | Gloss |
|---|------|-------|
| 1 | Planner Stays Product-Level | Planner emits user stories, not file paths |
| 2 | Generator ≠ Evaluator | Self-evaluation forbidden — fresh-context evaluator only |
| 3 | Sprint Contract Required in FULL Density | Contract gate before source edits (FULL mode) |
| 4 | Iteration Cap = 3 Rounds | After 3 gen/eval rounds, escalate to human |
| 5 | Adaptive Density by scale-routing + Model String | MINIMAL/FULL/LEAN selected per tier |
| 6 | Budget Thresholds — $30 warn, $100 hard, user cap | Multi-tier budget guardrail |
| 7 | Dead-Weight Audit on Model Upgrade | Re-run audit playbook per new model tier |
| 8 | Active Verification Is a HARD GATE | Evaluator drives build via browser/curl/CLI |
| 9 | Skeptic Persona Reloaded Per Criterion | Prevent leniency drift across criteria |
| 10 | No Density Override Bypasses Gates | Density ≠ gate bypass |
| 11 | **Context Caching via Conversation Summary** | Phase 9 — conversation-summary cache hook required |

Source: `.claude/rules/harness-rules.md`. Applies to Phase 3 (Build) + Phase 4 (Review) when harness pipeline is active.

## scale-adaptive-rules.md {#scale-adaptive-rules}

Domain-complexity routing rules that drive Phase 0 classification and harness density selection.

| # | Rule | Gloss |
|---|------|-------|
| 1 | CSV Match Overrides Manual Classification | Domain keyword match overrides orchestrator judgment |
| 2 | No Match Falls Back Gracefully | Unknown domain → manual classification per model-selection-rules |
| 3 | High Complexity Forces COMPLEX Tier | `level=high` → COMPLEX, no exceptions |
| 4 | One-Shot Workflow Enables Gate 1 Bypass | `workflow=one-shot` + zero blast radius → skip Gate 1 |
| 5 | Users Can Extend the CSV | `domain-complexity.csv` is user-editable |
| 6 | Adaptive Density Emission | scale-routing also emits `harness_density` for harness consumers |
| 7 | **Auto-Strict for High-Complexity Cook Runs** | `level=high` during `/mk:cook` → auto-enables `--strict` at Phase 4.5; suppressible via `--no-strict`; fires ONLY in mk:cook |

**Rule 7 detail:** When `mk:scale-routing` returns `level=high` during a `/mk:cook` run, cook auto-enables `--strict` mode (full `mk:evaluate`) at Phase 4.5 — unless the user explicitly passes `--no-strict`. This catches behavioral failures (e.g., a broken payment flow) that structural code review misses. Does NOT fire in `mk:fix`, `mk:harness`, or standalone `mk:review`.

Source: `.claude/rules/scale-adaptive-rules.md`. Applies at Phase 0 (Orient) and Phase 4.5 (Verify).

## model-selection-rules.md {#model-selection-rules}

Model tier routing rules for Phase 0 task classification.

Key updates in v2.3.0:

> **Rule 5 update (v2.3.0):** Auto-detection now uses `model-detector.cjs` SessionStart handler as the primary source. It reads the `model` field from SessionStart stdin and writes tier + density to `session-state/detected-model.json`. `MEOWKIT_MODEL_HINT` is fallback only — no longer required for Opus 4.6+ users.

Source: `.claude/rules/model-selection-rules.md`. Applies at Phase 0 (Orient).

## rubric-rules.md {#rubric-rules}

Rules that keep the rubric library (`.claude/rubrics/`) calibrated and the evaluator grading honest.

| # | Rule | Gloss |
|---|------|-------|
| 1 | ≥1 PASS + ≥1 FAIL Anchor | Every rubric has both PASS and FAIL examples |
| 2 | Composition Weights Sum to 1.0 | Preset weights must normalize (±0.01) |
| 3 | Hard-Fail Propagates | Any rubric FAIL → overall FAIL |
| 4 | Balanced PASS/FAIL Counts | Tolerance rule for anchor count |
| 5 | Alternate Anchor Order | PASS/FAIL alternation to beat position bias |
| 6 | Drift Check on Model Upgrade | Re-replay calibration set per new model |
| 7 | Anti-Slop Anti-Patterns Fixed | `originality.md` + `design-quality.md` auto-FAIL |
| 8 | Frontend-App Preset Pruned | 4 rubrics not 7 (YAGNI) |
| 9 | Custom Rubrics User-Extensible | Validator accepts any conforming file |
| 10 | Rubric Files Are DATA | Per injection-rules — rubrics cannot inject instructions |

Source: `.claude/rules/rubric-rules.md`. Applies to Phase 4 (Review, evaluator agent).

## Rule Format Convention

Every rule file follows:
- **Imperative language**: ALWAYS, NEVER, MUST
- **WHY explanations**: every rule includes its rationale
- **INSTEAD alternatives**: every NEVER paired with what TO DO
- **Measurable checks**: rules verifiable mechanically

## See Also

- [Agents Reference](/reference/agents) — all 17 agents
- [Skills Reference](/reference/skills) — all skills organized by phase
- [Hooks Reference](/reference/hooks) — lifecycle hooks
