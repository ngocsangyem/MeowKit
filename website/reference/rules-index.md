---
title: Rules Index
description: "All 16 MeowKit enforcement rules with priority, mechanism, and override conditions."
---

# Rules Index

Rules are loaded at session start. All mandatory unless marked `[CONTEXTUAL]`.

Source file: `.claude/rules/RULES_INDEX.md`

## Rules

| Rule | Purpose | Source | Applies to |
|------|---------|--------|-----------|
| `security-rules.md` | Block hardcoded secrets, any types, SQL injection, XSS patterns | MeowKit original | All modes, all phases |
| `injection-rules.md` | Prompt injection defense: DATA vs INSTRUCTIONS boundary | MeowKit original | All modes, all phases |
| `gate-rules.md` | Gate 1 (plan approval) and Gate 2 (review approval) hard stops | MeowKit original | Phases 1, 4 |
| `harness-rules.md` | Generator/evaluator architecture: planner stance, contract discipline, evaluator skepticism, iteration limits, adaptive density, dead-weight audit | New (Anthropic + LangChain harness research) | Phase 3 (Build, harness), Phase 4 (Review) |
| `rubric-rules.md` | Evaluator calibration discipline, rubric library governance, anchor balance, drift detection, anti-slop enforcement | New (Anthropic harness research) | Phase 4 (Review, evaluator) |
| `tdd-rules.md` | TDD enforcement (opt-in via `--tdd` / `MEOWKIT_TDD=1`); MICRO-TASK exemption included | MeowKit original | Phases 2, 3 **when TDD enabled** [CONTEXTUAL] |
| `naming-rules.md` | Naming conventions per platform (TS, Vue, Swift, DB) | MeowKit original | Implementation, review |
| `development-rules.md` | File management, code quality, pre-commit, git safety | Adapted from CKE | Implementation, commit |
| `orchestration-rules.md` | Subagent delegation, file ownership, parallel vs sequential | Adapted from CKE | Multi-agent `[CONTEXTUAL]` |
| `context-ordering-rules.md` | Long content first, context before constraint | Prompting best practices | Plans, prompts, handoffs |
| `model-selection-rules.md` | Task type → model tier routing, security escalation | Prompting best practices | Phase 0 (Orient) |
| `output-format-rules.md` | Response structure + subagent status protocol | CKE-inspired (v1.1.0) | All agent responses |
| `search-before-building-rules.md` | 3-layer knowledge: search before unfamiliar patterns | Adapted from gstack | Implementation, planning |
| `scale-adaptive-rules.md` | Domain complexity routing, CSV override, one-shot bypass | BMAD-inspired | Phase 0 (Orient) |
| `step-file-rules.md` | JIT step loading, no skipping, state persistence | BMAD-inspired | Step-file skills |
| `parallel-execution-rules.md` | Worktree isolation, max 3 agents, integration test | CKE-inspired | Parallel execution `[CONTEXTUAL]` |

## Loading Priority

Higher number = stronger override:

1. `security-rules.md` — NEVER override
2. `injection-rules.md` — NEVER override
3. `gate-rules.md` — NEVER override (except `/meow:fix` simple)
4. `harness-rules.md` — NEVER override gates; density choice does not bypass any gate
5. `rubric-rules.md` — NEVER override hard-fail propagation
6. `tdd-rules.md` — override only in `[fast]` mode
7. `naming-rules.md` — always apply
8. `development-rules.md` — always apply
9. `context-ordering-rules.md` — always apply
10. `model-selection-rules.md` — always apply
11. `output-format-rules.md` — always apply
12. `scale-adaptive-rules.md` — always apply at Phase 0
13. `step-file-rules.md` — apply when executing step-file workflows
14. `parallel-execution-rules.md` — apply during parallel execution `[CONTEXTUAL]`
15. `orchestration-rules.md` — apply in multi-agent workflows `[CONTEXTUAL]`

## Enforcement Mechanism Matrix

<span class="vp-badge info">v1.1.0</span>

| Rule | Mechanism | Override? | Exception |
|------|-----------|-----------|-----------|
| `security-rules.md` | Behavioral | NEVER | Human override only |
| `injection-rules.md` | Behavioral | NEVER | Human override only |
| `gate-rules.md` | Hook | NEVER | `/meow:fix` simple; scale-routing one-shot |
| `harness-rules.md` | Behavioral + Hook (`gate-enforcement.sh`, `validate-verdict.sh`) | NEVER override gates | Density modes adjust scaffolding, not gate semantics |
| `rubric-rules.md` | Behavioral + Script (`validate-rubric.sh`) | NEVER override hard-fail propagation | Custom rubrics addable; semantics fixed |
| `tdd-rules.md` | Behavioral | Yes | `[fast]` mode |
| `naming-rules.md` | Behavioral | No | — |
| `development-rules.md` | Behavioral | No | — |
| `orchestration-rules.md` | Behavioral | N/A | `[CONTEXTUAL]` |
| `context-ordering-rules.md` | Behavioral | No | — |
| `model-selection-rules.md` | Behavioral | No | Domain override via CSV |
| `output-format-rules.md` | Behavioral | No | — |
| `search-before-building-rules.md` | Behavioral | No | — |
| `scale-adaptive-rules.md` | Behavioral + Data | No | CSV user-extensible |
| `step-file-rules.md` | Behavioral | N/A | Step-file skills only |
| `parallel-execution-rules.md` | Behavioral + Worktree | N/A | `[CONTEXTUAL]` |

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

Discipline rules for the autonomous multi-hour build pipeline (`meow:harness`) and the generator/evaluator architecture.

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

- [Agents Index](/reference/agents-index) — all 15 agents
- [Skills Index](/reference/skills-index) — all 60+ skills
- [Hooks Reference](/reference/hooks) — lifecycle hooks
