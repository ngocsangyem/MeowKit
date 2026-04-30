---
title: Skills Overview
description: "All 68+ MeowKit skills organized by category."
persona: C
---

# Skills Overview

MeowKit ships 68+ skills using the `mk:` namespace prefix.

## Architecture

Each skill folder follows a two-layer design: a compact decision router (`SKILL.md`, ~100 lines) that handles routing logic inline, and a `references/` directory for detailed procedures loaded on demand. This keeps context overhead low — agents load only what each phase requires.

```
mk:skill-name/
├── SKILL.md          # Decision router (~100 lines)
├── references/       # Detailed procedures (loaded on-demand)
│   ├── workflow-*.md
│   └── patterns.md
├── scripts/          # Validation scripts
├── bin/              # Shell hooks
└── assets/           # Templates, configs
```

:::tip On-demand loading
Skills only load their `references/` files when the relevant phase is active. This prevents flooding the context window with procedures that don't apply to the current step.
:::

## Skill Types

Skills fall into distinct types based on purpose and phase alignment.

| Type | Purpose | Examples |
|------|---------|---------|
| Intake & Triage | Ticket analysis, completeness scoring, product area detection | intake |
| Pipeline | End-to-end workflows orchestrating multiple phases | cook, fix, ship, workflow-orchestrator |
| Quality Gate | Enforce standards at specific phase boundaries | review, cso, vulnerability-scanner, lint-and-validate |
| Planning | Plan creation, review, and ideation | plan-creator, plan-ceo-review, office-hours |
| Exploration | Codebase search, debugging, doc retrieval | scout, investigate, docs-finder |
| Domain | Stack-specific patterns and conventions | typescript, vue, frontend-design |
| Backend & Data | API design, database patterns, build error resolution | api-design, build-fix, database |
| External Integrations | Jira and Figma execution via MCP | jira, figma |
| Safety | Prevent destructive actions, scope edits | careful, freeze, skill-template-secure |
| Infrastructure | Agent routing, loading, skill creation | agent-detector, lazy-agent-loader, skill-creator |
| Reference Toolkit | Guides loaded by agents during specific phases | development, testing, planning, shipping, documentation, memory |
| Utility | Cross-cutting tools (browser, media, docs gen) | browse, agent-browser, multimodal, llms, qa, qa-manual, playwright-cli |

## Plan-First Gate

Most pipeline and quality skills check for an approved plan before proceeding. The table below documents each skill's gate behavior and the conditions under which planning is skipped.

| Skill | Gate behavior | Skip condition |
|-------|-------------|----------------|
| mk:cook | Create plan if missing | Plan path arg, --fast mode |
| mk:fix | Plan if > 2 files | --quick mode |
| mk:ship | Require approved plan | Hotfix with human approval |
| mk:cso | Scope audit via plan | --daily mode |
| mk:qa | Create QA scope doc | Quick tier |
| mk:review | Read plan for context | PR diff reviews |
| mk:workflow-orchestrator | Route to plan-creator | Fasttrack mode |
| mk:investigate | Produces input FOR plans | Always skips |
| mk:office-hours | Pre-planning skill | Always skips |
| mk:retro | Data-driven, no plan | Always skips |
| mk:document-release | Scope from diff | Post-ship sync |

:::info Why some skills always skip planning
Skills that skip planning have documented reasons — they either produce planning input (investigate, office-hours) or are data-driven and operate after the ship phase (retro, document-release).
:::

## Pipeline Skills

Full development pipelines that orchestrate multiple phases.

| Skill | What it does |
|-------|-------------|
| [mk:cook](/reference/skills/cook) | End-to-end feature pipeline: plan → test → build → review → ship |
| [mk:fix](/reference/skills/fix) | Structured bug investigation with auto-complexity detection |
| [mk:ship](/reference/skills/ship) | Ship pipeline: merge, test, review, version, commit, PR |
| [mk:verify](/reference/skills/verify) | Unified verification: build→lint→test→type-check→coverage, fail-fast |
| [mk:workflow-orchestrator](/reference/skills/workflow-orchestrator) | 5-phase TDD workflow with token budgets and fast-track |
| [mk:session-continuation](/reference/skills/session-continuation) | Save/resume workflow state across sessions |

## Quality & Review

Code quality enforcement, review, and security scanning.

| Skill | What it does |
|-------|-------------|
| [mk:review](/reference/skills/review) | Multi-pass code review with adversarial analysis |
| [mk:elicit](/reference/skills/elicit) | Structured second-pass reasoning via 8 named methods (pre-mortem, red team, Socratic, etc.) |
| [mk:nyquist](/reference/skills/nyquist) | Test-to-requirement coverage mapping — gaps report from plan criteria vs test files |
| [mk:cso](/reference/skills/cso) | Chief Security Officer — infrastructure-first audit |
| [mk:vulnerability-scanner](/reference/skills/vulnerability-scanner) | OWASP 2025 code-level scanning |
| [mk:clean-code](/reference/skills/clean-code) | Pragmatic coding standards (SRP, DRY, KISS) |
| [mk:lint-and-validate](/reference/skills/lint-and-validate) | Auto-run linters + type checks after changes |

## Planning & Design

Plan creation, review, and ideation.

| Skill | What it does |
|-------|-------------|
| [mk:plan-creator](/reference/skills/plan-creator) | Auto-select plan template by task scope |
| [mk:validate-plan](/reference/skills/validate-plan) | 8-dimension plan quality validation before Phase 2 begins |
| [mk:plan-ceo-review](/reference/skills/plan-ceo-review) | CEO-mode plan review with scope expansion |
| [mk:plan-ceo-review](/reference/skills/plan-ceo-review) | Engineering plan review — architecture, edges, tests |
| [mk:office-hours](/reference/skills/office-hours) | YC-style brainstorming (startup + builder modes) |
| [mk:brainstorming](/reference/skills/brainstorming) | Structured ideation with scoring + plan-creator handoff |
| [mk:decision-framework](/reference/skills/decision-framework) | Operational decision architecture: triage, escalation, case management |
| [mk:api-design](/reference/skills/api-design) | REST/GraphQL API design patterns |

## Exploration & Research

Codebase exploration, debugging, and documentation retrieval.

| Skill | What it does |
|-------|-------------|
| [mk:scout](/reference/skills/scout) | Parallel codebase exploration via Explore subagents |
| [mk:investigate](/reference/skills/investigate) | Systematic 5-phase root cause debugging |
| [mk:docs-finder](/reference/skills/docs-finder) | Library/project docs via Context7 + Context Hub |
| [mk:sequential-thinking](/reference/skills/sequential-thinking) | Hypothesis-driven reasoning for root cause analysis |
| [mk:problem-solving](/reference/skills/problem-solving) | Strategic unsticking — 7 non-default techniques for "stuck on approach" |

## Browser & QA Testing

Browser automation, QA testing, and E2E code generation.

| Skill | What it does |
|-------|-------------|
| [mk:qa-manual](/reference/skills/qa-manual) | Spec-driven manual QA + Playwright E2E code gen |
| [mk:qa](/reference/skills/qa) | Systematic QA with bug fixing and health scores |
| [mk:browse](/reference/skills/browse) | Fast headless browser (~100ms/command) |
| [mk:agent-browser](/reference/skills/agent-browser) | Chrome/CDP with session persistence and auth |
| [mk:playwright-cli](/reference/skills/playwright-cli) | Playwright MCP with code generation |

## Frontend

TypeScript, Vue, React, and UI/UX design patterns.

| Skill | What it does |
|-------|-------------|
| [mk:typescript](/reference/skills/typescript) | Strict TS: null handling, type guards, utility types |
| [mk:vue](/reference/skills/vue) | Vue 3 Composition API, Pinia, reactivity |
| [mk:angular](/reference/skills/angular) | Angular v20+ patterns — 10 topics consolidated (components, signals, DI, forms, routing, HTTP, SSR, testing, tooling) |
| [mk:react-patterns](/reference/skills/react-patterns) | React/Next.js performance — 45+ rules from Vercel Engineering |
| [mk:frontend-design](/reference/skills/frontend-design) | UI/UX with anti-AI-slop enforcement |
| [mk:ui-design-system](/reference/skills/ui-design-system) | Design intelligence: styles, WCAG 2.1 AA, palettes, quality checklists |

## Backend & Data

API design, database patterns, and build error resolution.

| Skill | What it does |
|-------|-------------|
| [mk:api-design](/reference/skills/api-design) | REST/GraphQL patterns: resource naming, HTTP methods, status codes, pagination, versioning, rate limiting, error formats |
| [mk:build-fix](/reference/skills/build-fix) | Build error triage: detect language, load fix references, classify fixability, chain into mk:verify |
| [mk:database](/reference/skills/database) | Schema design, safe migrations, query optimization. PostgreSQL primary |

## External Integrations

Jira and Figma execution via MCP.

| Skill | What it does |
|-------|-------------|
| [mk:jira](/reference/skills/jira) | Jira execution & ticket intelligence via Atlassian MCP: create, search, update, transition, link, sprint, evaluate complexity, estimate story points, analyze tickets. 4-tier safety framework, internal jira-* agents |
| [mk:confluence](/reference/skills/confluence) | Confluence spec analysis: fetch pages as markdown, extract requirements, detect gaps, produce research reports. Reports only — no ticket creation |
| [mk:planning-engine](/reference/skills/planning-engine) | Codebase-aware tech breakdown and sprint planning analysis: dependency mapping, capacity modeling, complexity signals. Reports only — no auto-assignment |
| [mk:figma](/reference/skills/figma) | Figma design analysis + implementation via Figma MCP. 3 modes: analyze, implement, tokens. Fallback to PNG + multimodal |

## Analysis & Media

Multimodal analysis and documentation generation.

| Skill | What it does |
|-------|-------------|
| [mk:multimodal](/reference/skills/multimodal) | Image/video/audio/PDF via Gemini API |
| [mk:llms](/reference/skills/llms) | Generate llms.txt per llmstxt.org spec |

## Safety & Scoping

Destructive command prevention and edit restrictions.

| Skill | What it does |
|-------|-------------|
| [mk:careful](/reference/skills/careful) | Warn before rm -rf, DROP TABLE, force-push |
| [mk:freeze](/reference/skills/freeze) | Restrict edits to one directory |
| [mk:skill-template-secure](/reference/skills/skill-template-secure) | Secure template for skills handling untrusted input |

## Infrastructure

Agent detection, loading, skill creation, and project organization.

| Skill | What it does |
|-------|-------------|
| [mk:agent-detector](/reference/skills/agent-detector) | Auto-detect agent + complexity + model per message |
| [mk:lazy-agent-loader](/reference/skills/lazy-agent-loader) | On-demand agent loading for token savings |
| [mk:skill-creator](/reference/skills/skill-creator) | Scaffold + validate + register new skills |
| [mk:project-organization](/reference/skills/project-organization) | File naming, directory structure standards |
| [mk:bootstrap](/reference/skills/bootstrap) | Application scaffold for any stack with progressive generation |

## Documentation & Release

Post-ship docs, retrospectives, and release management.

| Skill | What it does |
|-------|-------------|
| [mk:docs-init](/reference/skills/docs-init) | Generate initial docs from codebase analysis |
| [mk:document-release](/reference/skills/document-release) | Post-ship doc sync — cross-reference diff against docs |
| [mk:retro](/reference/skills/retro) | Sprint retrospective with commit analysis + trends |

## Reference Toolkits

Collections of reference guides loaded by agents during specific phases.

| Skill | What it does |
|-------|-------------|
| [mk:development](/reference/skills/development) | Code patterns, TDD, skill loading (Phase 3) |
| [mk:memory](/reference/skills/memory) | Session capture, patterns, cost tracking (Phase 0, 6) |
| [mk:testing](/reference/skills/testing) | Red-green-refactor, validation, visual QA (Phase 2-3) |

## See Also

- [Agent-Skill Architecture](/guide/agent-skill-architecture) — how agents and skills interact across workflow phases
- [Workflow Phases](/guide/workflow-phases) — the 6-phase pipeline from Orient to Reflect
- [Agents Overview](/reference/agents/) — the full agent roster and ownership model
