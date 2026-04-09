# MeowKit Rules Index

Rules are loaded by the agent at session start.
All rules are mandatory unless marked [CONTEXTUAL].

| Rule                              | Purpose                                                                                                                                            | Source                                       | Applies to                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| `security-rules.md`               | Block hardcoded secrets, any types, SQL injection, XSS patterns                                                                                    | MeowKit original                             | All modes, all phases                               |
| `injection-rules.md`              | Prompt injection defense: DATA vs INSTRUCTIONS boundary                                                                                            | MeowKit original                             | All modes, all phases                               |
| `gate-rules.md`                   | Gate 1 (plan approval) and Gate 2 (review approval) hard stops                                                                                     | MeowKit original                             | Phases 1, 4                                         |
| `tdd-rules.md`                    | TDD enforcement (opt-in via MEOWKIT_TDD=1 / --tdd). Includes MICRO-TASK exemption.                                                                 | MeowKit original                             | Phases 2, 3 **when TDD enabled** [CONTEXTUAL]       |
| `naming-rules.md`                 | Naming conventions per platform (TS, Vue, Swift, DB)                                                                                               | MeowKit original                             | Implementation, review                              |
| `development-rules.md`            | File management, code quality, pre-commit, git safety, docs impact                                                                                 | Adapted from claudekit-engineer              | Implementation, commit                              |
| `orchestration-rules.md`          | Subagent delegation, file ownership, parallel vs sequential                                                                                        | Adapted from claudekit-engineer              | Multi-agent workflows [CONTEXTUAL]                  |
| `context-ordering-rules.md`       | Long content first, context before constraint, self-contained docs                                                                                 | New (prompting best practices)               | Plans, prompts, handoffs                            |
| `model-selection-rules.md`        | Task type → model tier routing, security escalation                                                                                                | New (prompting best practices)               | Phase 0 (Orient)                                    |
| `output-format-rules.md`          | Response structure: what/why/files/open-qs + subagent status protocol                                                                              | New + CKE-inspired (v1.1.0)                  | All agent responses                                 |
| `search-before-building-rules.md` | 3-layer knowledge framework: search before implementing unfamiliar patterns                                                                        | Adapted from gstack ETHOS.md                 | Implementation, planning                            |
| `scale-adaptive-rules.md`         | Domain-based complexity routing, CSV match override, Gate 1 one-shot bypass                                                                        | New (BMAD-inspired)                          | Phase 0 (Orient)                                    |
| `harness-rules.md`                | Generator/evaluator architecture: planner stance, contract discipline, evaluator skepticism, iteration limits, adaptive density, dead-weight audit | New (Anthropic + LangChain harness research) | Phase 3 (Build, harness pipeline), Phase 4 (Review) |
| `rubric-rules.md`                 | Evaluator calibration discipline, rubric library governance, anchor balance enforcement, drift detection cadence, anti-slop anti-patterns          | New (Anthropic harness research)             | Phase 4 (Review, evaluator agent)                   |
| `step-file-rules.md`              | JIT step loading, no skipping, state persistence for multi-step workflows                                                                          | New (BMAD-inspired)                          | Step-file skills                                    |
| `parallel-execution-rules.md`     | Worktree isolation, file ownership, max 3 agents, integration test. Added staged parallel mode (v2.0)                                              | New (CKE-inspired)                           | Parallel execution [CONTEXTUAL]                     |

## Loading Priority

Rules are applied in this priority (higher = stronger override):

1. `security-rules.md` — NEVER override
2. `injection-rules.md` — NEVER override
3. `gate-rules.md` — NEVER override (except /fix simple bypasses Gate 1)
4. `harness-rules.md` — NEVER override gates; density choice does not bypass any gate
5. `rubric-rules.md` — NEVER override hard-fail propagation
6. `tdd-rules.md` — applies only when `MEOWKIT_TDD=1` / `--tdd`; default OFF. Legacy `[fast]` profile bypass retained with deprecation warning.
7. `naming-rules.md` — always apply
8. `development-rules.md` — always apply
9. `context-ordering-rules.md` — always apply
10. `model-selection-rules.md` — always apply
11. `output-format-rules.md` — always apply
12. `scale-adaptive-rules.md` — always apply at Phase 0
13. `step-file-rules.md` — apply when executing step-file workflows
14. `parallel-execution-rules.md` — apply during parallel agent execution [CONTEXTUAL]
15. `orchestration-rules.md` — apply only in multi-agent workflows [CONTEXTUAL]

## Hook Enforcement

MeowKit uses shell hooks to upgrade behavioral rules to preventive enforcement:

| Hook                              | Event        | Purpose                                                        |
| --------------------------------- | ------------ | -------------------------------------------------------------- |
| `hooks/privacy-block.sh`          | PreToolUse   | Block sensitive file reads before they happen (Rule 4 upgrade) |
| `hooks/gate-enforcement.sh`       | PreToolUse   | Block source code writes before Gate 1 approval                |
| `hooks/project-context-loader.sh` | SessionStart | Auto-load project-context.md into agent context                |

Hooks supplement rules — they do not replace them. Rules define the WHY; hooks enforce the WHAT.

## Enforcement Mechanism Matrix (v1.1.0)

| Rule                              | Mechanism                                                                                                | Override?                            | Exception                                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `security-rules.md`               | Behavioral                                                                                               | NEVER                                | Human override only, documented                                                                                                         |
| `injection-rules.md`              | Behavioral                                                                                               | NEVER                                | Human override only, documented                                                                                                         |
| `gate-rules.md`                   | Hook (gate-enforcement.sh)                                                                               | NEVER                                | `/meow:fix` simple bypasses Gate 1; scale-routing one-shot                                                                              |
| `harness-rules.md`                | Behavioral + Hook (gate-enforcement.sh contract gate, validate-verdict.sh active-verification HARD GATE) | NEVER override gates                 | Density modes adjust scaffolding, not gate semantics                                                                                    |
| `rubric-rules.md`                 | Behavioral + Script (validate-rubric.sh, check-product-spec.sh)                                          | NEVER override hard-fail propagation | Custom rubrics can be added; existing rubric semantics are fixed                                                                        |
| `tdd-rules.md`                    | Behavioral + Hook (`pre-implement.sh`, gated by `MEOWKIT_TDD` env or sentinel file)                      | Yes                                  | Default OFF. Opt in via `--tdd` / `MEOWKIT_TDD=1`. Legacy `MEOW_PROFILE=fast` retained with deprecation warn. [CONTEXTUAL]              |
| `naming-rules.md`                 | Behavioral                                                                                               | No                                   | —                                                                                                                                       |
| `development-rules.md`            | Behavioral                                                                                               | No                                   | —                                                                                                                                       |
| `orchestration-rules.md`          | Behavioral                                                                                               | N/A                                  | [CONTEXTUAL] — only in multi-agent workflows                                                                                            |
| `context-ordering-rules.md`       | Behavioral                                                                                               | No                                   | —                                                                                                                                       |
| `model-selection-rules.md`        | Behavioral                                                                                               | No                                   | Domain override via scale-routing CSV                                                                                                   |
| `output-format-rules.md`          | Behavioral                                                                                               | No                                   | —                                                                                                                                       |
| `search-before-building-rules.md` | Behavioral                                                                                               | No                                   | —                                                                                                                                       |
| `scale-adaptive-rules.md`         | Behavioral + CSV data                                                                                    | No                                   | CSV extensible by users                                                                                                                 |
| `step-file-rules.md`              | Behavioral                                                                                               | N/A                                  | Only applies to step-file skills                                                                                                        |
| `parallel-execution-rules.md`     | Behavioral + worktree                                                                                    | N/A                                  | [CONTEXTUAL] — only during parallel execution                                                                                           |

**Mechanism types:**

- **Behavioral** — Agent follows rules via system prompt. Relies on LLM compliance.
- **Hook** — Shell script intercepts tool calls before execution. Preventive enforcement.
- **Data** — External file (CSV, JSON) drives decisions. User-extensible.

## Rule Format Convention

Every rule file follows this structure:

- **Frontmatter**: source, original_file, adapted, adaptation_notes
- **Imperative language**: ALWAYS, NEVER, MUST (not "consider", "try to")
- **WHY explanations**: every rule includes its rationale
- **INSTEAD alternatives**: every NEVER is paired with what TO DO instead
- **Measurable checks**: rules can be verified mechanically, not subjectively
