# MeowKit Skills Index

Centralized registry of all skills. Updated: 2026-03-30 (v1.1.0).

## By Phase

### Phase 0 — Orient

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `meow:agent-detector` | orchestrator | utility | monolithic |
| `meow:help` | orchestrator | utility | monolithic |
| `meow:lazy-agent-loader` | orchestrator | utility | monolithic |
| `meow:project-context` | orchestrator | utility | monolithic |
| `meow:scale-routing` | orchestrator | utility | monolithic |
| `meow:scout` | orchestrator | cross-cutting | monolithic |
| `meow:session-continuation` | orchestrator | cross-cutting | monolithic |
| `meow:task-queue` | orchestrator | utility | monolithic |
| `meow:team-config` | orchestrator | utility | monolithic |
| `meow:workflow-orchestrator` | orchestrator | cross-cutting | monolithic |
| `meow:memory` | analyst | memory | monolithic |

### Phase 1 — Plan

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `meow:plan-creator` | planner | planning | step-file (v1.5.0: scope challenge, multi-file output, plan red team, sync-back, **--product-level mode** for green-field app builds via step-03a; **--deep mode** for per-phase scouting; **--tdd flag** injects TDD sections into phase files; **standalone subcommands**: archive/red-team/validate; outputs `red-team-findings.md`; solution design checklist in each phase; memory capture at Gate 1) |
| `meow:plan-ceo-review` | planner | planning | monolithic |
| `meow:plan-eng-review` | planner/architect | planning | monolithic |
| `meow:validate-plan` | planner | planning | monolithic |
| `meow:brainstorming` | brainstormer | planning | monolithic |
| `meow:office-hours` | brainstormer/planner | planning | monolithic |
| `meow:party` | orchestrator | planning | monolithic |

### Phase 2 — Test RED

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `meow:testing` | tester | testing | monolithic |
| `meow:nyquist` | tester | testing | monolithic |
| `meow:lint-and-validate` | tester | testing | monolithic |
| `meow:qa` | tester | testing | monolithic |
| `meow:qa-manual` | tester | testing | monolithic |
| `meow:browse` | tester | testing | monolithic |
| `meow:playwright-cli` | tester | testing | monolithic |

### Phase 3 — Build GREEN

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `meow:development` | developer | development | monolithic |
| `meow:cook` | developer | development | monolithic |
| `meow:fix` | developer | development | monolithic |
| `meow:debug` | developer | development | monolithic |
| `meow:investigate` | tester/developer | development | monolithic |
| `meow:simplify` | developer | development | monolithic |
| `meow:clean-code` | developer | development | monolithic |
| `meow:sequential-thinking` | developer | development | monolithic |
| `meow:project-organization` | developer | development | monolithic |
| `meow:bootstrap` | developer | development | monolithic |
| `meow:agent-browser` | developer | development | monolithic |

#### Language/Framework Skills (Phase 3)

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `meow:typescript` | developer | development | monolithic |
| `meow:vue` | developer | development | monolithic |
| `meow:angular` | developer | development | monolithic |
| `meow:react-patterns` | developer | development | monolithic |
| `meow:frontend-design` | developer | development | monolithic |
| `meow:ui-design-system` | developer | development | monolithic |

### Phase 4 — Review

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `meow:review` | reviewer | review | **step-file** (4 steps) |
| `meow:rubric` | evaluator | review | monolithic (v1.0.0: 7 rubrics + 4 composition presets at .claude/rubrics/, weighted graded grading with PASS/WARN/FAIL anchors and load/compose/validate scripts; frontend-app preset pruned to 4 distinctive rubrics in v2.0.0 per audit 260408) |
| `meow:evaluate` | evaluator | review | **step-file** (v1.0.0: 5 steps — load-rubrics → boot-app → probe-criteria → grade-and-verdict → feedback-to-generator. Active-verification HARD GATE: validate-verdict.sh rejects PASS verdicts with empty evidence/. Skeptic persona enforced on every criterion grading.) |
| `meow:sprint-contract` | developer (propose/amend) + evaluator (review) | planning | monolithic (v1.0.0, 130 lines: propose/review/amend/sign actions inline. Phase 4 file-based contract negotiation between generator and evaluator before source edits. Enforced by gate-enforcement.sh; bypassable via MEOWKIT_HARNESS_MODE=LEAN.) |
| `meow:harness` | orchestrator (planner/developer/evaluator/shipper agents dispatched per step) | orchestration | **step-file** (v1.0.0: 7 steps — tier-detection → plan → contract → generate → evaluate → iterate-or-ship → run-report. Adaptive density MINIMAL/FULL/LEAN. Budget tracker with $30 warn / $100 block. 6h hard timeout. Resumable via --resume.) |
| `meow:trace-analyze` | researcher (3 parallel) + main agent synthesis | analysis | **step-file** (v1.0.0: 6 steps — ingest → partition → scatter → gather → suggestions → HITL gate. Reads `.claude/memory/trace-log.jsonl`, finds patterns via error-taxonomy, mandatory HITL approval. Anti-overfit threshold ≥3 occurrences.) |
| `meow:benchmark` | orchestrator (invokes meow:harness per spec) | measurement | monolithic (v1.0.0: run/compare subcommands. Quick tier 5 tasks ≤$5; full tier 6 tasks ≤$30. Records to `.claude/benchmarks/results/{run-id}.json` + trace-log.jsonl. Backs the dead-weight audit with measured deltas.) |
| `meow:elicit` | reviewer | review | monolithic |

### Security (Phase 2, 4)

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `meow:cso` | security/reviewer | security | monolithic |
| `meow:vulnerability-scanner` | security/reviewer | security | monolithic |
| `meow:skill-template-secure` | security | security | monolithic |

### Phase 5 — Ship

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `meow:ship` | shipper | deployment | monolithic |
| `meow:shipping` | shipper | deployment | monolithic |

### Phase 6 — Reflect

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| `meow:documentation` | documenter | documentation | monolithic |
| `meow:document-release` | shipper/documenter | documentation | monolithic |
| `meow:docs-init` | documenter | documentation | monolithic |
| `meow:llms` | documenter | documentation | monolithic |
| `meow:retro` | analyst/documenter | memory | monolithic |
| `meow:skill-creator` | orchestrator | utility | monolithic |
| `meow:worktree` | orchestrator | utility | monolithic |

### Cross-Cutting (Any Phase)

| Skill | Owner | Trigger |
|-------|-------|---------|
| `meow:careful` | any agent | Before destructive commands |
| `meow:freeze` | any agent | Debug session scoping |
| `meow:docs-finder` | any agent | Library/API documentation lookup |
| `meow:multimodal` | any agent | Visual content analysis |
| `meow:scout` | orchestrator/reviewer | Codebase exploration |
| `meow:web-to-markdown` | any agent | Fetch arbitrary URLs as clean markdown — use when URL is not covered by meow:docs-finder. Static-only by default; Playwright opt-in via `mewkit setup --system-deps`. |

## Summary

| Category | Count |
|----------|-------|
| Planning | 7 |
| Testing | 7 |
| Development | 17 |
| Review | 2 |
| Security | 3 |
| Deployment | 2 |
| Documentation | 4 |
| Memory | 2 |
| Utility | 9 |
| Cross-Cutting | 6 |
| **Total** | **59** |

Note: Some skills appear in multiple categories (scout, investigate). Count reflects primary category.

## Architecture Types

- **Monolithic** — Single SKILL.md file. Used for skills <150 lines.
- **Step-file** — SKILL.md + workflow.md + step-NN-*.md. Used for skills with 3+ phases.

Currently step-file enabled:
- `meow:plan-creator` — 9 steps (00–08)
- `meow:review` — 4 steps
- `meow:evaluate` — 5 steps
- `meow:harness` — 7 steps
- `meow:trace-analyze` — 6 steps
