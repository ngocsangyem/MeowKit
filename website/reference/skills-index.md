---
title: Skills Index
description: "All 60+ MeowKit skills organized by phase with owner, type, and architecture."
---

# Skills Index

<span class="vp-badge info">v1.1.0</span>

Source file: `.claude/agents/SKILLS_INDEX.md`

## Phase 0 — Orient

| Skill | Owner | Type |
|-------|-------|------|
| [agent-detector](/reference/skills/agent-detector) | orchestrator | utility |
| [lazy-agent-loader](/reference/skills/lazy-agent-loader) | orchestrator | utility |
| [scout](/reference/skills/scout) | orchestrator | cross-cutting |
| [scale-routing](/reference/skills/agent-detector) | orchestrator | utility |
| [session-continuation](/reference/skills/session-continuation) | orchestrator | cross-cutting |
| [memory](/reference/skills/memory) | analyst | memory |
| [chom](/reference/skills/chom) | researcher | research |

## Phase 1 — Plan

| Skill | Owner | Type |
|-------|-------|------|
| [plan-creator](/reference/skills/plan-creator) | planner | planning |
| [plan-ceo-review](/reference/skills/plan-ceo-review) | planner | planning |
| [validate-plan](/reference/skills/validate-plan) | planner | planning |
| [brainstorming](/reference/skills/brainstorming) | brainstormer | planning |
| [office-hours](/reference/skills/office-hours) | brainstormer/planner | planning |

## Phase 2 — Test (RED if `--tdd`, optional otherwise)

| Skill | Owner | Type |
|-------|-------|------|
| [testing](/reference/skills/testing) | tester | testing |
| [nyquist](/reference/skills/nyquist) | tester | testing |
| [lint-and-validate](/reference/skills/lint-and-validate) | tester | testing |
| [qa](/reference/skills/qa) | tester | testing |
| [qa-manual](/reference/skills/qa-manual) | tester | testing |
| [browse](/reference/skills/browse) | tester | testing |
| [playwright-cli](/reference/skills/playwright-cli) | tester | testing |

## Phase 3 — Build GREEN

| Skill | Owner | Type |
|-------|-------|------|
| [cook](/reference/skills/cook) | developer | pipeline |
| [fix](/reference/skills/fix) | developer | pipeline |
| [development](/reference/skills/development) | developer | development |
| [clean-code](/reference/skills/clean-code) | developer | development |
| [typescript](/reference/skills/typescript) | developer | development |
| [vue](/reference/skills/vue) | developer | development |
| [angular](/reference/skills/angular) | developer | development |
| [react-patterns](/reference/skills/react-patterns) | developer | development |
| [frontend-design](/reference/skills/frontend-design) | developer | development |
| [ui-design-system](/reference/skills/ui-design-system) | developer | development |

## Phase 4 — Review

| Skill | Owner | Type | Architecture |
|-------|-------|------|-------------|
| [review](/reference/skills/review) | reviewer | review | **step-file** (4 steps) |
| [elicit](/reference/skills/elicit) | reviewer | review | monolithic |
| [cso](/reference/skills/cso) | security/reviewer | security | monolithic |
| [vulnerability-scanner](/reference/skills/vulnerability-scanner) | security/reviewer | security | monolithic |

## Phase 5 — Ship

| Skill | Owner | Type |
|-------|-------|------|
| [ship](/reference/skills/ship) | shipper | deployment |

## Phase 6 — Reflect

| Skill | Owner | Type |
|-------|-------|------|
| [document-release](/reference/skills/document-release) | documenter | documentation |
| [docs-init](/reference/skills/docs-init) | documenter | documentation |
| [llms](/reference/skills/llms) | documenter | documentation |
| [retro](/reference/skills/retro) | analyst | memory |

## Cross-Cutting (Any Phase)

| Skill | Trigger |
|-------|---------|
| [careful](/reference/skills/careful) | Before destructive commands |
| [freeze](/reference/skills/freeze) | Debug session scoping |
| [docs-finder](/reference/skills/docs-finder) | Library/API documentation lookup |
| [multimodal](/reference/skills/multimodal) | Visual content analysis |
| [scout](/reference/skills/scout) | Codebase exploration |
| [sequential-thinking](/reference/skills/sequential-thinking) | Evidence-based hypothesis testing for root cause |
| [problem-solving](/reference/skills/problem-solving) | Stuck on approach — strategic unsticking via 7 techniques |

## Architecture Types

- **Monolithic** — Single `SKILL.md` file. Used for skills <150 lines.
- **Step-file** — `SKILL.md` + `workflow.md` + `step-NN-*.md`. Used for 3+ phases.

Currently step-file enabled: `meow:review` (4 steps).

## See Also

- [Skills Overview](/reference/skills/) — categorized skill descriptions
- [Agents Index](/reference/agents-index) — agent ownership
- [Rules Index](/reference/rules-index) — enforcement rules
- [Agent-Skill Architecture](/guide/agent-skill-architecture) — how agents load skills
