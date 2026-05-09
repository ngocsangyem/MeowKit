<!-- HUMAN-ONLY: navigation aid for the rules directory. Not auto-loaded by Claude Code. Edit alongside .claude/rules/ changes. -->

# MeowKit Rules Index

Rules are loaded by the agent at session start.
All rules are mandatory unless marked [CONTEXTUAL].

| Rule                              | Purpose                                                                                                                                            | Source                                       | Applies to                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| `security-rules.md`               | Block hardcoded secrets, any types, SQL injection, XSS patterns                                                                                    | MeowKit original                             | All modes, all phases                               |
| `injection-rules.md`              | Prompt injection defense: DATA vs INSTRUCTIONS boundary; Rule 11 = Skill Rule of Two                                                               | MeowKit original                             | All modes, all phases                               |
| `gate-rules.md`                   | Gate 1 (plan approval) and Gate 2 (review approval) hard stops                                                                                     | MeowKit original                             | Phases 1, 4                                         |
| `core-behaviors.md`               | 6 mandatory operating behaviors: Surface Assumptions, Manage Confusion, Push Back, Enforce Simplicity, Scope Discipline, Verify Don't Assume       | Adapted from agent-skills                    | All modes, all phases                               |
| `tdd-rules.md`                    | TDD enforcement (opt-in via MEOWKIT_TDD=1 / --tdd). Includes MICRO-TASK exemption.                                                                 | MeowKit original                             | Phases 2, 3 **when TDD enabled** [CONTEXTUAL]       |
| `agent-conduct.md`                | Two-tier merge: file naming (B1), response structure (B2), context ordering (B3), search-before-building (B4), plan-resumption (B5); subagent status protocol (A1), project-context-first (A2), eureka documentation (A3) | MeowKit original (merged from 4 sources) | Implementation, review, all agent responses |
| `development-rules.md`            | File management, code quality, pre-commit, git safety, docs impact                                                                                 | Adapted from claudekit-engineer              | Implementation, commit                              |
| `orchestration-rules.md`          | Subagent delegation, file ownership, parallel vs sequential                                                                                        | Adapted from claudekit-engineer              | Multi-agent workflows [CONTEXTUAL]                  |
| `harness-rules.md`                | Generator/evaluator architecture: planner stance, contract discipline, evaluator skepticism, iteration limits, adaptive density, dead-weight audit | New (Anthropic + LangChain harness research) | Phase 3 (Build, harness pipeline), Phase 4 (Review) |
| `rubric-rules.md`                 | Evaluator calibration discipline, rubric library governance, anchor balance enforcement, drift detection cadence, anti-slop anti-patterns          | New (Anthropic harness research)             | Phase 4 (Review, evaluator agent)                   |
| `step-file-rules.md`              | JIT step loading, no skipping, state persistence for multi-step workflows                                                                          | New (BMAD-inspired)                          | Step-file skills                                    |
| `parallel-execution-rules.md`     | Worktree isolation, file ownership, max 3 agents, integration test. Added staged parallel mode (v2.0)                                              | New (CKE-inspired)                           | Parallel execution [CONTEXTUAL]                     |
| `skill-authoring-rules.md`        | Mandatory Gotchas section, persistent state in `${CLAUDE_PLUGIN_DATA}`, 500-line SKILL.md cap with decomposition + audit cadence, required `keywords`/`when_to_use`/`user-invocable` frontmatter (Rule 4) | New (Anthropic skill-authoring docs)         | Skill authoring, audits                             |
| `post-phase-delegation.md`        | Fire points, skip conditions, and invocation form for delegating to project-manager after each phase transition                                    | MeowKit original                             | Orchestration skills [CONTEXTUAL]                   |

### Phase-Zero Conditional Rules (`.claude/rules-conditional/`)

Loaded explicitly by `mk:agent-detector` Step 0b — NOT auto-loaded by Claude Code's directory mechanism. Out of always-on tier; only reaches context when agent-detector runs (every user message).

| Rule | Purpose | Loaded by |
| ---- | ------- | --------- |
| `phase-contracts.md` | Phase I/O contracts table — what each phase expects/produces | `mk:agent-detector` Step 0b |
| `agent-routing.md` | Agent → role → phase routing table; PM opt-out env var | `mk:agent-detector` Step 0b |
| `model-selection-rules.md` | Task type → model tier routing, security escalation | `mk:agent-detector` Step 0b |
| `scale-adaptive-rules.md` | Domain-based complexity routing, CSV match override, Gate 1 one-shot bypass | `mk:agent-detector` Step 0b |
| `risk-checklist.md` | Phase 0 horizontal-risk flag eval (9 flags); auto-escalation feeds `model-selection-rules.md` Rule 2 | `mk:agent-detector` Step 0b |

## Loading Priority

Rules are applied in this priority (higher = stronger override):

1. `security-rules.md` — NEVER override
2. `injection-rules.md` — NEVER override
3. `gate-rules.md` — NEVER override (except /fix simple bypasses Gate 1)
4. `harness-rules.md` — NEVER override gates; density choice does not bypass any gate
5. `rubric-rules.md` — NEVER override hard-fail propagation
6. `core-behaviors.md` — always apply (6 behaviors + 10 failure modes)
7. `tdd-rules.md` — applies only when `MEOWKIT_TDD=1` / `--tdd`; default OFF. Legacy `[fast]` profile bypass retained with deprecation warning.
8. `agent-conduct.md` — always apply (file naming, response structure, context ordering, search-before-building, plan-resumption, subagent status protocol)
9. `development-rules.md` — always apply
10. `step-file-rules.md` — apply when executing step-file workflows
11. `parallel-execution-rules.md` — apply during parallel agent execution [CONTEXTUAL]
12. `orchestration-rules.md` — apply only in multi-agent workflows [CONTEXTUAL]
13. `skill-authoring-rules.md` — apply during skill authoring, scaffolding, and quarterly/model-upgrade audits
14. `post-phase-delegation.md` — apply during orchestration-skill execution only [CONTEXTUAL]

**Phase-zero conditional** (loaded by `mk:agent-detector` Step 0b only — NOT auto-loaded):
- `rules-conditional/phase-contracts.md`
- `rules-conditional/agent-routing.md`
- `rules-conditional/model-selection-rules.md`
- `rules-conditional/scale-adaptive-rules.md`
- `rules-conditional/risk-checklist.md`

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
| `gate-rules.md`                   | Hook (gate-enforcement.sh)                                                                               | NEVER                                | `/mk:fix` simple bypasses Gate 1; scale-routing one-shot                                                                              |
| `harness-rules.md`                | Behavioral + Hook (gate-enforcement.sh contract gate, validate-verdict.sh active-verification HARD GATE) | NEVER override gates                 | Density modes adjust scaffolding, not gate semantics                                                                                    |
| `rubric-rules.md`                 | Behavioral + Script (validate-rubric.sh, check-product-spec.sh)                                          | NEVER override hard-fail propagation | Custom rubrics can be added; existing rubric semantics are fixed                                                                        |
| `tdd-rules.md`                    | Behavioral + Manual Script (`pre-implement.sh` — invoked by developer agent, not wired to system events)  | Yes                                  | Default OFF. Opt in via `--tdd` / `MEOWKIT_TDD=1`. Legacy `MEOW_PROFILE=fast` retained with deprecation warn. [CONTEXTUAL]              |
| `agent-conduct.md`                | Behavioral                                                                                               | No                                   | Tier A (A1/A2/A3) preserves rationale verbatim; Tier B (B1–B5) compressed                                                              |
| `development-rules.md`            | Behavioral                                                                                               | No                                   | —                                                                                                                                       |
| `orchestration-rules.md`          | Behavioral                                                                                               | N/A                                  | [CONTEXTUAL] — only in multi-agent workflows                                                                                            |
| `model-selection-rules.md`        | Behavioral                                                                                               | No                                   | Domain override via scale-routing CSV                                                                                                   |
| `scale-adaptive-rules.md`         | Behavioral + CSV data                                                                                    | No                                   | CSV extensible by users                                                                                                                 |
| `risk-checklist.md`               | Behavioral + DATA                                                                                        | No                                   | Flags advisory; escalation routed through `model-selection-rules.md` Rule 2                                                             |
| `step-file-rules.md`              | Behavioral                                                                                               | N/A                                  | Only applies to step-file skills                                                                                                        |
| `parallel-execution-rules.md`     | Behavioral + worktree                                                                                    | N/A                                  | [CONTEXTUAL] — only during parallel execution                                                                                           |
| `skill-authoring-rules.md`        | Behavioral + Script (500-line audit `find` one-liner) + Hook (`scripts/validate-skill-frontmatter.py` via `ci.yml`)                                                    | No                                   | MeowKit-internal infra paths exempt from Rule 2; step-filed skills auto-pass Rule 3; Rule 4 fields validated mechanically (ERROR for schema violations, WARN for missing `when_to_use`)                                                     |
| `post-phase-delegation.md`        | Behavioral                                                                                               | N/A                                  | [CONTEXTUAL] — only when an orchestration skill is active. `MEOWKIT_PM_AUTO=off` disables silent fires                                  |
| `phase-contracts.md`              | Behavioral                                                                                               | No                                   | —                                                                                                                                       |
| `agent-routing.md`                | Behavioral                                                                                               | No                                   | `MEOWKIT_PM_AUTO=off` disables silent project-manager fires                                                                             |

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
