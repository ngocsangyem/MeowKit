# MeowKit Skills Index

Centralized registry of all skills. Updated: 2026-03-30 (v1.1.0).

## By Phase

### Phase 0 — Orient

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `mk:agent-detector` | orchestrator | utility | monolithic |
| `mk:help` | orchestrator | utility | monolithic |
| `mk:lazy-agent-loader` | orchestrator | utility | monolithic |
| `mk:project-context` | orchestrator | utility | monolithic |
| `mk:scale-routing` | orchestrator | utility | monolithic |
| `mk:scout` | orchestrator | cross-cutting | monolithic |
| `mk:session-continuation` | orchestrator | cross-cutting | monolithic |
| `mk:task-queue` | orchestrator | utility | monolithic |
| `mk:team-config` | orchestrator | utility | monolithic |
| `mk:workflow-orchestrator` | orchestrator | cross-cutting | monolithic |
| `mk:memory` | analyst | memory | monolithic |
| `mk:skill-creator` | orchestrator | utility | monolithic |
| `mk:worktree` | orchestrator | utility | monolithic |

### Phase 1 — Plan

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `mk:plan-creator` | planner | planning | step-file (v1.5.0: scope challenge, multi-file output, plan red team, sync-back, **--product-level mode** for green-field app builds via step-03a; **--deep mode** for per-phase scouting; **--tdd flag** injects TDD sections into phase files; **standalone subcommands**: archive/red-team/validate; outputs `red-team-findings.md`; solution design checklist in each phase; memory capture at Gate 1) |
| `mk:plan-ceo-review` | planner | planning | monolithic (v2.0: layered verification pipeline — pre-screen + two-lens eval + severity tiers + adversarial necessity + append-only verdict) |
| `mk:validate-plan` | planner | planning | monolithic |
| `mk:brainstorming` | brainstormer | planning | monolithic |
| `mk:office-hours` | brainstormer/planner | planning | monolithic |
| `mk:party` | orchestrator/brainstormer | planning | monolithic |

### Phase 2 — Test RED

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `mk:testing` | tester | testing | monolithic |
| `mk:nyquist` | tester | testing | monolithic |
| `mk:lint-and-validate` | tester | testing | monolithic |
| `mk:qa` | tester | testing | monolithic |
| `mk:qa-manual` | tester | testing | monolithic |
| `mk:browse` | tester | testing | monolithic |
| `mk:playwright-cli` | tester | testing | monolithic |

### Phase 3 — Build GREEN

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `mk:development` | developer | development | monolithic |
| `mk:cook` | developer | development | monolithic |
| `mk:fix` | developer | development | monolithic |
| `mk:investigate` | tester/developer | development | monolithic |
| `mk:simplify` | developer | development | monolithic |
| `mk:clean-code` | developer | development | monolithic |
| `mk:sequential-thinking` | developer | development | monolithic |
| `mk:problem-solving` | developer | development | monolithic |
| `mk:project-organization` | developer | development | monolithic |
| `mk:bootstrap` | developer | development | monolithic |
| `mk:verify` | developer | development | monolithic |
| `mk:build-fix` | developer | development | monolithic |
| `mk:api-design` | architect | development | monolithic |
| `mk:database` | developer | development | monolithic |
| `mk:decision-framework` | planner | development | monolithic |
| `mk:figma` | ui-ux-designer | development | monolithic |
| `mk:jira` | orchestrator | integration | monolithic |
| `mk:intake` | orchestrator | integration | monolithic |
| `mk:agent-browser` | developer | development | monolithic |

#### Language/Framework Skills (Phase 3)

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `mk:typescript` | developer | development | monolithic |
| `mk:vue` | developer | development | monolithic |
| `mk:angular` | developer | development | monolithic |
| `mk:react-patterns` | developer | development | monolithic |
| `mk:frontend-design` | developer | development | monolithic |
| `mk:ui-design-system` | developer | development | monolithic |

### Phase 4 — Review

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `mk:review` | reviewer | review | **step-file** (4 steps) |
| `mk:rubric` | evaluator | review | monolithic (v1.0.0: 7 rubrics + 4 composition presets at .claude/rubrics/, weighted graded grading with PASS/WARN/FAIL anchors and load/compose/validate scripts; frontend-app preset pruned to 4 distinctive rubrics in v2.0.0 per audit 260408) |
| `mk:evaluate` | evaluator | review | **step-file** (v1.0.0: 5 steps — load-rubrics → boot-app → probe-criteria → grade-and-verdict → feedback-to-generator. Active-verification HARD GATE: validate-verdict.sh rejects PASS verdicts with empty evidence/. Skeptic persona enforced on every criterion grading.) |
| `mk:sprint-contract` | developer (propose/amend) + evaluator (review) | planning | monolithic (v1.0.0, 130 lines: propose/review/amend/sign actions inline. Phase 4 file-based contract negotiation between generator and evaluator before source edits. Enforced by gate-enforcement.sh; bypassable via MEOWKIT_HARNESS_MODE=LEAN.) |
| `mk:harness` | orchestrator (planner/developer/evaluator/shipper agents dispatched per step) | orchestration | **step-file** (v1.0.0: 7 steps — tier-detection → plan → contract → generate → evaluate → iterate-or-ship → run-report. Adaptive density MINIMAL/FULL/LEAN. Budget tracker with $30 warn / $100 block. 6h hard timeout. Resumable via --resume.) |
| `mk:trace-analyze` | researcher (3 parallel) + main agent synthesis | analysis | **step-file** (v1.0.0: 6 steps — ingest → partition → scatter → gather → suggestions → HITL gate. Reads `.claude/memory/trace-log.jsonl`, finds patterns via error-taxonomy, mandatory HITL approval. Anti-overfit threshold ≥3 occurrences.) |
| `mk:benchmark` | orchestrator (invokes mk:harness per spec) | measurement | monolithic (v1.0.0: run/compare subcommands. Quick tier 5 tasks ≤$5; full tier 6 tasks ≤$30. Records to `.claude/benchmarks/results/{run-id}.json` + trace-log.jsonl. Backs the dead-weight audit with measured deltas.) |
| `mk:elicit` | reviewer | review | monolithic |

### Security (Phase 2, 4)

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `mk:cso` | security/reviewer | security | monolithic |
| `mk:vulnerability-scanner` | security/reviewer | security | monolithic |
| `mk:skill-template-secure` | security | security | monolithic |

### Phase 5 — Ship

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `mk:ship` | shipper | deployment | monolithic |

### Phase 6 — Reflect

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `mk:document-release` | shipper/documenter | documentation | monolithic |
| `mk:docs-init` | documenter | documentation | monolithic |
| `mk:llms` | documenter | documentation | monolithic |
| `mk:retro` | analyst/documenter | memory | monolithic |

### Cross-Cutting (Any Phase)

| Skill | Owner | Trigger |
|-------|-------|---------|
| `mk:careful` | any agent | Before destructive commands |
| `mk:freeze` | any agent | Debug session scoping |
| `mk:docs-finder` | any agent (primary: researcher) | Library/API documentation lookup |
| `mk:multimodal` | any agent | Visual content analysis |
| `mk:web-to-markdown` | any agent | Fetch arbitrary URLs as clean markdown — use when URL is not covered by mk:docs-finder. Static-only by default; Playwright opt-in via `mewkit setup --system-deps`. |
| `mk:henshin` | any agent | Planning front door for wrapping existing code as agent-consumable surfaces (CLI + MCP + companion skill). Produces a Transformation Spec; hands off to `mk:plan-creator` → `mk:cook`. Adapted from claudekit-engineer/agentize (v1.0.0). |

## Summary

| Category | Count |
|----------|-------|
| Planning | 6 |
| Testing | 7 |
| Development | 26 |
| Review | 8 |
| Security | 3 |
| Deployment | 2 |
| Documentation | 4 |
| Memory | 2 |
| Utility | 12 |
| Cross-Cutting | 5 |
| **Total** | **75** |

Note: Some skills appear in multiple categories (scout, investigate). Count reflects primary category. `mk:memory` counted under Memory (not Utility). `mk:retro` counted under Memory (not Documentation).

## Architecture Types

- **Monolithic** — Single SKILL.md file. Used for skills <150 lines.
- **Step-file** — SKILL.md + workflow.md + step-NN-*.md. Used for skills with 3+ phases.

Currently step-file enabled:
- `mk:plan-creator` — 9 steps (00–08)
- `mk:review` — 5 steps (includes step-02b persona passes)
- `mk:evaluate` — 5 steps
- `mk:harness` — 7 steps
- `mk:trace-analyze` — 6 steps
