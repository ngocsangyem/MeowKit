<!-- HUMAN-ONLY: navigation aid for the rules directory. Not auto-loaded by Claude Code. Edit alongside .claude/rules/ changes. -->

# MeowKit Rules Index

The always-on set is exactly 7 files under `.claude/rules/`. The host auto-loads that
directory every session, so those 7 are the only rules that cost context unconditionally —
the budget for the set is 25 600 bytes, enforced by `scripts/check-always-on-budget.cjs`.
Every other rule moved next to the skill that loads it and reaches context just in time.

No kit-owned root `CLAUDE.md` ships. A target project may keep its own `CLAUDE.md`; it is
project-owned, never installed or refreshed by the kit.

Full background rationale lives in `docs/governance/rule-rationale.md`; read it before
modifying rules. The old-path → new-path mapping for the context diet, line by line, is
`docs/maintainer/rule-destination-table.md`.

## Always-On Rules (7)

| Rule | Purpose | Applies to |
| --- | --- | --- |
| `meowkit-core.md` | Role, the 7-phase workflow, the two gates in brief, the DATA/INSTRUCTIONS boundary, the memory contract, the compaction policy | All modes, all phases |
| `security-rules.md` | Block hardcoded secrets, `any` types, SQL interpolation, XSS and the rest of the blocked-pattern table | All modes, all phases |
| `injection-rules.md` | Prompt-injection defense: DATA vs INSTRUCTIONS boundary; Rule 11 = Skill Rule of Two | All modes, all phases |
| `gate-rules.md` | Gate 1 (plan approval) and Gate 2 (review approval) hard stops, the Gate Authority Invariant, and Recording Human Interventions | Phases 1, 4 |
| `core-behaviors.md` | 6 mandatory operating behaviors (Surface Assumptions, Manage Confusion, Push Back, Enforce Simplicity, Scope Discipline, Verify Don't Assume) plus the Anti-Rationalization table | All modes, all phases |
| `development-rules.md` | YAGNI/KISS/DRY, file management, code quality, pre-commit, git safety, docs impact, tool-output limits | Implementation, commit |
| `agent-conduct.md` | A1 subagent status protocol, A3 eureka documentation, B2 response structure | All agent responses |

`mewkit validate` checks all 7 for presence: a missing file silently drops enforcement, so
the presence check replaced the former root-`CLAUDE.md` check.

## Moved Rules — Where They Live Now

Each file below left `.claude/rules/` in the context diet and is loaded on demand by the
skill that owns it. Nothing was dropped: the enforcement text moved intact.

| Rule | New location | Loaded by |
| --- | --- | --- |
| `harness-rules.md` | `.claude/skills/cook/references/` | `mk:cook`, `mk:autobuild` |
| `tdd-rules.md` | `.claude/skills/cook/references/` | `mk:cook` (Phases 2–3), `mk:fix` |
| `phase-contracts.md` | `.claude/skills/cook/references/` | `mk:agent-detector` Step 0b |
| `post-phase-delegation.md` | `.claude/skills/cook/references/` | orchestration skills |
| `task-state-emission.md` | `.claude/skills/cook/references/` | `mk:cook`, `mk:autobuild` |
| `parallel-execution-rules.md` | `.claude/skills/cook/references/` | `mk:worktree`, `mk:team-config`, parallel runs |
| `orchestration-rules.md` | `.claude/skills/cook/references/` | multi-agent workflows |
| `model-selection-rules.md` | `.claude/skills/agent-detector/references/` | `mk:agent-detector` Step 0b |
| `scale-adaptive-rules.md` | `.claude/skills/agent-detector/references/` | `mk:agent-detector` Step 0b |
| `risk-checklist.md` | `.claude/skills/agent-detector/references/` | `mk:agent-detector` Step 0b |
| `agent-routing.md` | `.claude/skills/agent-detector/references/` | `mk:agent-detector` Step 0b |
| `context-budget-rules.md` | `.claude/skills/agent-detector/references/` | `mk:agent-detector`, `mk:context-audit` |
| `rubric-rules.md` | `.claude/skills/rubric/references/` | `mk:rubric`, evaluator agent |
| `skill-authoring-rules.md` | `.claude/skills/skill-creator/references/` | `mk:skill-creator`, skill audits |
| `dead-weight-audit-rules.md` | `.claude/skills/benchmark/references/` | `mk:benchmark` |
| `docs-reference-contract.md` | `docs/maintainer/` (source repo only, not shipped) | maintainers, `npx mewkit validate` |
| `step-file-rules.md` | inlined as `## Step-File Contract` in each step-filed skill's `workflow.md` | `mk:plan-creator`, `mk:review`, `mk:evaluate`, `mk:autobuild`, `mk:trace-analyze` |
| `anti-rationalization.md` | merged into `.claude/rules/core-behaviors.md` | always-on |
| `intervention-recording-rules.md` | merged into `.claude/rules/gate-rules.md` ("Recording Human Interventions") | always-on |

The Tier-A/Tier-B sections of the pre-diet `agent-conduct.md` that are not A1/A3/B2 — A2
(project context first), B1 (naming), B3 (context ordering), B4 (search before building),
B5 (plan status on resumption), B6 (context hygiene) — live verbatim in
`.claude/skills/cook/references/agent-conduct-extended.md`.

`scripts/check-dangling-rule-refs.cjs` fails the build if any of these files is referenced
at its old path, or if a destination has no load step naming it.

### Agile Conditional Rules (`.claude/rules-conditional/`)

Loaded by `mk:agent-detector` Step 0b ONLY when an Agile context is detected (sprint-state contract present, `jira_tickets:` in plan frontmatter, `MEOW_JIRA_BASE_URL` env, or Jira-key pattern in user prompt). Non-Agile sessions pay zero context cost.

| Rule | Purpose | Loaded by |
| ---- | ------- | --------- |
| `agile-story-gates.md` | Definition of Ready (Phase 1 entry) + Definition of Done (Gate 2 PASS) + traceability frontmatter contract | `mk:agent-detector` Step 0b (Agile context) |
| `agile-sprint-commitment.md` | Sprint goal persistence, mid-sprint amendment ceremony, sprint close hygiene | `mk:agent-detector` Step 0b (Agile context) |
| `agile-feedback-cycle.md` | Retro action-item ceremony, spike governance (timebox + findings doc) | `mk:agent-detector` Step 0b (Agile context) |

### Workflow Conditional Rules (`.claude/rules-conditional/`)

Not Agile-gated. Each is loaded on demand by the consuming skill, so a session that does
not reach the relevant surface pays zero context cost.

| Rule | Purpose | Loaded by |
| ---- | ------- | --------- |
| `workflow-evidence-rules.md` | One-run evidence index: pointers + normalized summaries of plan/diagnosis/verify/verdict/approvals. Records gate results; never approves | `mk:fix`, `mk:cook`, `mk:review`, `mk:ship` on demand |
| `advice-supervision-rules.md` | `--advice` supervision lane: activation, the `GUIDE → RESCUE* → REVIEW → RECHECK*` cadence with per-stage and per-skill caps, input/output packets and their caps, stage-legal dispositions, continuity dossier, correction cycle, prohibitions, receipt. Supervision is evidence, never gate authority and never verification | Skills run with `--advice`, at their first named checkpoint |

## Loading Priority

A just-in-time rule never overrides an always-on one. Within the always-on set, higher =
stronger override:

1. `security-rules.md` — NEVER override
2. `injection-rules.md` — NEVER override
3. `gate-rules.md` — NEVER override (except `/mk:fix` simple bypasses Gate 1)
4. `core-behaviors.md` — always apply (6 behaviors + anti-rationalization)
5. `meowkit-core.md` — always apply (workflow, gates in brief, memory, compaction policy)
6. `agent-conduct.md` — always apply (A1 status protocol, A3 eureka, B2 response structure)
7. `development-rules.md` — always apply

Just-in-time rules apply when their owning skill loads them, and only there:
`harness-rules.md` and `rubric-rules.md` never override a gate; `tdd-rules.md` applies only
when `MEOWKIT_TDD=1` / `--tdd`; `parallel-execution-rules.md`, `orchestration-rules.md` and
`post-phase-delegation.md` are contextual; `context-budget-rules.md` is advisory and never a
gate.

## Hook Enforcement

MeowKit uses shell hooks to upgrade behavioral rules to preventive enforcement:

| Hook                              | Event        | Purpose                                                        |
| --------------------------------- | ------------ | -------------------------------------------------------------- |
| `hooks/privacy-block.cjs`          | PreToolUse   | Block sensitive file reads before they happen (Rule 4 upgrade) |
| `hooks/gate-enforcement.cjs`       | PreToolUse   | Block source code writes before Gate 1 approval                |
| `hooks/project-context-loader.cjs` | SessionStart | Auto-load project-context.md into agent context                |

Hooks supplement rules — they do not replace them. Rules define the WHY; hooks enforce the WHAT.

## Enforcement Mechanism Matrix

### Always-on

| Rule | Mechanism | Override? | Exception |
| --- | --- | --- | --- |
| `security-rules.md` | Behavioral | NEVER | Human override only, documented |
| `injection-rules.md` | Behavioral | NEVER | Human override only, documented |
| `gate-rules.md` | Hook (`gate-enforcement.cjs`) | NEVER | `/mk:fix` simple bypasses Gate 1; scale-routing one-shot |
| `core-behaviors.md` | Behavioral | No | — |
| `meowkit-core.md` | Behavioral + Script (`check-always-on-budget.cjs`) | No | — |
| `agent-conduct.md` | Behavioral | No | A1/A3 preserve rationale verbatim; B2 compressed |
| `development-rules.md` | Behavioral | No | — |

### Just-in-time

| Rule | Mechanism | Override? | Exception |
| --- | --- | --- | --- |
| `harness-rules.md` | Behavioral + Hook (`gate-enforcement.cjs` contract gate, `validate-verdict.sh` active-verification HARD GATE) | NEVER override gates | Density modes adjust scaffolding, not gate semantics |
| `rubric-rules.md` | Behavioral + Script (`validate-rubric.sh`, `check-product-spec.sh`) | NEVER override hard-fail propagation | Custom rubrics can be added; existing rubric semantics are fixed |
| `tdd-rules.md` | Behavioral + Manual Script (`pre-implement.cjs` — invoked by the developer agent, not wired to system events) | Yes | Default OFF. Opt in via `--tdd` / `MEOWKIT_TDD=1` |
| `orchestration-rules.md` | Behavioral | N/A | Contextual — only in multi-agent workflows |
| `model-selection-rules.md` | Behavioral | No | Domain override via scale-routing CSV |
| `scale-adaptive-rules.md` | Behavioral + CSV data | No | CSV extensible by users |
| `risk-checklist.md` | Behavioral + DATA | No | Flags advisory; escalation routed through the model-selection rules Rule 2 |
| `parallel-execution-rules.md` | Behavioral + worktree | N/A | Contextual — only during parallel execution |
| `skill-authoring-rules.md` | Behavioral + Script (500-line audit `find` one-liner) + CI (`npx mewkit validate --frontmatter` via `ci.yml`) | No | MeowKit-internal infra paths exempt from Rule 2; step-filed skills auto-pass Rule 3 |
| `post-phase-delegation.md` | Behavioral | N/A | Contextual. `MEOWKIT_PM_AUTO=off` disables silent fires |
| `phase-contracts.md` | Behavioral | No | — |
| `agent-routing.md` | Behavioral | No | `MEOWKIT_PM_AUTO=off` disables silent project-manager fires |
| `context-budget-rules.md` | Behavioral | N/A | Advisory read-budget; never a gate |
| `dead-weight-audit-rules.md` | Behavioral + Benchmark data | No | Requires measured deltas, not subjective judgment |
| `step-file-rules.md` | Behavioral (inlined in each step-filed `workflow.md`) | N/A | Step-file skills only |

**Mechanism types:**

- **Behavioral** — Agent follows rules via system prompt. Relies on LLM compliance.
- **Hook** — Shell script intercepts tool calls before execution. Preventive enforcement.
- **Data** — External file (CSV, JSON) drives decisions. User-extensible.

## Rule Format Convention

Every rule file follows this structure:

- **Imperative language**: ALWAYS, NEVER, MUST (not "consider", "try to")
- **WHY explanations**: every rule includes its rationale
- **INSTEAD alternatives**: every NEVER is paired with what TO DO instead
- **Measurable checks**: rules can be verified mechanically, not subjectively
