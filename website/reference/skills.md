---
title: Skills Reference
description: Complete skill index — all skills organized by workflow phase with brief descriptions.
---

# Skills Reference

MeowKit ships skills using the `mk:` namespace. Each skill loads on demand — agents activate only skills relevant to their phase. Detailed procedures live in `references/` within each skill directory and load only when needed.

## Phase 0 — Orient

Skills for task classification, context loading, and agent routing.

| Skill | What it does |
|-------|-------------|
| `mk:agent-detector` | Auto-detect agent, complexity, and model tier per message |
| `mk:lazy-agent-loader` | On-demand agent loading for token efficiency |
| `mk:scout` | Parallel codebase exploration via Explore subagents |
| `mk:scale-routing` | Domain-based complexity classification (CSV-driven) |
| `mk:project-context` | Generate/update `docs/project-context.md` from codebase |

## Phase 1 — Plan

Skills for planning, research, and ideation.

| Skill | What it does |
|-------|-------------|
| `mk:plan-creator` | Auto-select plan template by task scope. 9-step workflow (00-08) |
| `mk:validate-plan` | 8-dimension plan quality check before Phase 2 |
| `mk:plan-ceo-review` | CEO-mode plan review (product lens + engineering lens) |
| `mk:office-hours` | YC-style brainstorming (startup + builder modes) |
| `mk:brainstorming` | Structured ideation with scoring and plan-creator handoff |
| `mk:decision-framework` | Triage, escalation, and case management for architecture decisions |
| `mk:api-design` | REST/GraphQL API design patterns |

## Phase 2 — Test

Skills for test writing, quality gates, and security scanning.

| Skill | What it does |
|-------|-------------|
| `mk:testing` | Red-green-refactor TDD workflow, validation, visual QA |
| `mk:nyquist` | Test-to-requirement coverage mapping |
| `mk:lint-and-validate` | Auto-run linters and type checks |
| `mk:cso` | Chief Security Officer — infrastructure-first audit |
| `mk:vulnerability-scanner` | OWASP 2025 code-level scanning |
| `mk:skill-template-secure` | Secure template for skills handling untrusted input |

## Phase 3 — Build

Skills for implementation, debugging, and domain-specific patterns.

| Skill | What it does |
|-------|-------------|
| `mk:cook` | End-to-end feature pipeline: plan → test → build → review → ship |
| `mk:harness` | Autonomous green-field build pipeline with generator/evaluator loop |
| `mk:development` | Code patterns, TDD discipline, skill loading reference |
| `mk:fix` | Structured bug investigation with auto-complexity detection |
| `mk:investigate` | Systematic 5-phase root cause debugging |
| `mk:sequential-thinking` | Hypothesis-driven reasoning for root cause analysis |
| `mk:problem-solving` | Strategic unsticking — 7 techniques for "stuck on approach" |
| `mk:simplify` | Mandatory over-engineering removal pass after build |
| `mk:verify` | Unified build→lint→test→type-check→coverage verification |
| `mk:build-fix` | Build error triage with language detection and fix references |
| `mk:sprint-contract` | Negotiate testable acceptance criteria before generator touches code |
| `mk:clean-code` | Pragmatic coding standards (SRP, DRY, KISS) |
| `mk:bootstrap` | Application scaffold for any stack with progressive generation |

### Frontend

| Skill | What it does |
|-------|-------------|
| `mk:typescript` | Strict TS: null handling, type guards, utility types |
| `mk:vue` | Vue 3 Composition API, Pinia, reactivity |
| `mk:angular` | Angular v20+ patterns — components, signals, DI, forms, routing, SSR |
| `mk:react-patterns` | React/Next.js performance — 45+ rules from Vercel Engineering |
| `mk:frontend-design` | UI/UX with anti-AI-slop enforcement |
| `mk:ui-design-system` | Design intelligence: styles, WCAG 2.1 AA, palettes, checklists |

### Backend & Data

| Skill | What it does |
|-------|-------------|
| `mk:database` | Schema design, safe migrations, query optimization (PostgreSQL primary) |
| `mk:api-design` | REST/GraphQL patterns: naming, status codes, pagination, versioning |

## Phase 4 — Review

Skills for code review, security audit, and elicitation.

| Skill | What it does |
|-------|-------------|
| `mk:review` | Multi-pass adversarial code review with parallel reviewers |
| `mk:elicit` | Structured second-pass reasoning via 8 methods (pre-mortem, red team, Socratic) |
| `mk:evaluate` | Behavioral active-verification grader with rubric presets |
| `mk:rubric` | Load, validate, and compose rubric presets for evaluator grading |

## Phase 5 — Ship

Skills for deployment and release management.

| Skill | What it does |
|-------|-------------|
| `mk:ship` | Ship pipeline: test → review → commit → PR |
| `mk:worktree` | Git worktree isolation for parallel agent sessions |

## Phase 6 — Reflect

Skills for documentation, retrospectives, and memory capture.

| Skill | What it does |
|-------|-------------|
| `mk:memory` | Session capture, pattern extraction, cost tracking |
| `mk:retro` | Sprint retrospective with commit analysis and trend tracking |
| `mk:document-release` | Post-ship doc sync — cross-reference diff against docs |
| `mk:docs-init` | Generate initial docs from codebase analysis |

## Cross-Phase Skills

Skills that can activate in any phase.

| Skill | What it does |
|-------|-------------|
| `mk:docs-finder` | Library/project docs via Context7 + Context Hub |
| `mk:help` | Navigation assistant — scans project state, recommends next pipeline step |
| `mk:careful` | Warn before `rm -rf`, `DROP TABLE`, force-push |
| `mk:freeze` | Restrict edits to one directory during debugging |
| `mk:multimodal` | Image/video/audio/PDF analysis via Gemini API |
| `mk:agent-browser` | Chrome/CDP with session persistence and auth |
| `mk:web-to-markdown` | Convert web pages to markdown for context injection |
| `mk:llms` | Generate llms.txt per llmstxt.org spec |
| `mk:session-continuation` | Save/resume workflow state across sessions |
| `mk:henshin` | Wrap existing code as agent-consumable surfaces (CLI + MCP + skill) |
| `mk:intake` | Ticket analysis, completeness scoring, product area detection |
| `mk:task-queue` | Queue management for multi-task sessions |

### QA & Browser

| Skill | What it does |
|-------|-------------|
| `mk:qa` | Systematic QA with bug fixing and health scores |
| `mk:qa-manual` | Spec-driven manual QA + Playwright E2E code generation |
| `mk:playwright-cli` | Playwright MCP with code generation |

### External Integrations

| Skill | What it does |
|-------|-------------|
| `mk:jira` | Jira ticket intelligence via Atlassian MCP. Internal agents: jira-evaluator, jira-estimator, jira-analyst |
| `mk:confluence` | Confluence spec analysis: fetch pages, extract requirements, detect gaps |
| `mk:figma` | Figma design analysis + implementation via Figma MCP. 3 modes: analyze, implement, tokens |

### Infrastructure

| Skill | What it does |
|-------|-------------|
| `mk:skill-creator` | Scaffold, validate, and register new skills |
| `mk:project-organization` | File naming and directory structure standards |
| `mk:team-config` | Team-level MeowKit configuration |

### Special-Purpose

| Skill | What it does |
|-------|-------------|
| `mk:party` | Multi-agent deliberation for architecture decisions (2-4 agents, forced synthesis) |
| `mk:workflow-orchestrator` | Auto-invoked 7-phase orchestrator for complex-feature intent |
| `mk:benchmark` | Canary suite for dead-weight audit measurement |
| `mk:trace-analyze` | Scatter-gather analysis of harness trace logs |
| `mk:planning-engine` | Codebase-aware tech breakdown and sprint planning analysis |
| `mk:chom` | Code chomping — extract relevant code sections for context |
| `mk:pack` | Package code for portable context injection |

## Plan-first gate

Most pipeline skills enforce a plan-first gate. Skills that skip planning either produce planning input or are data-driven.

| Skill | Gate behavior | Skip condition |
|-------|-------------|----------------|
| `mk:cook` | Create plan if missing | Plan path arg, `--fast` mode |
| `mk:fix` | Plan if > 2 files | `--quick` mode |
| `mk:ship` | Require approved plan | Hotfix with human approval |
| `mk:cso` | Scope audit via plan | `--daily` mode |
| `mk:review` | Read plan for context | PR diff reviews |

## See also

- [How agents and skills work together](/core-concepts/how-it-works)
- [Workflow phases](/core-concepts/workflow)
- [Agents reference](/reference/agents)
- [Skill definitions on disk](https://github.com/ngocsangyem/MeowKit/tree/main/.claude/skills) — canonical source (SKILL.md files)
