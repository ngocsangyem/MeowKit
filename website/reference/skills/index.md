---
title: Skills Overview
description: "All 48 MeowKit skills organized by category."
persona: C
---

# Skills Overview

MeowKit ships 43 skills using the `meow:` namespace prefix.

## Architecture

Each skill folder follows a two-layer design: a compact decision router (`SKILL.md`, ~100 lines) that handles routing logic inline, and a `references/` directory for detailed procedures loaded on demand. This keeps context overhead low — agents load only what each phase requires.

```
meow:skill-name/
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
| Pipeline | End-to-end workflows orchestrating multiple phases | cook, fix, ship, workflow-orchestrator |
| Quality Gate | Enforce standards at specific phase boundaries | review, cso, vulnerability-scanner, lint-and-validate |
| Planning | Plan creation, review, and ideation | plan-creator, plan-ceo-review, plan-eng-review, office-hours |
| Exploration | Codebase search, debugging, doc retrieval | scout, investigate, docs-finder |
| Domain | Stack-specific patterns and conventions | typescript, vue, frontend-design |
| Safety | Prevent destructive actions, scope edits | careful, freeze, skill-template-secure |
| Infrastructure | Agent routing, loading, skill creation | agent-detector, lazy-agent-loader, skill-creator |
| Reference Toolkit | Guides loaded by agents during specific phases | development, testing, planning, shipping, documentation, memory |
| Utility | Cross-cutting tools (browser, media, docs gen) | browse, agent-browser, multimodal, llms, qa, qa-manual, playwright-cli |

## Plan-First Gate

Most pipeline and quality skills check for an approved plan before proceeding. The table below documents each skill's gate behavior and the conditions under which planning is skipped.

| Skill | Gate behavior | Skip condition |
|-------|-------------|----------------|
| meow:cook | Create plan if missing | Plan path arg, --fast mode |
| meow:fix | Plan if > 2 files | --quick mode |
| meow:ship | Require approved plan | Hotfix with human approval |
| meow:cso | Scope audit via plan | --daily mode |
| meow:qa | Create QA scope doc | Quick tier |
| meow:review | Read plan for context | PR diff reviews |
| meow:workflow-orchestrator | Route to plan-creator | Fasttrack mode |
| meow:investigate | Produces input FOR plans | Always skips |
| meow:office-hours | Pre-planning skill | Always skips |
| meow:retro | Data-driven, no plan | Always skips |
| meow:document-release | Scope from diff | Post-ship sync |

:::info Why some skills always skip planning
Skills that skip planning have documented reasons — they either produce planning input (investigate, office-hours) or are data-driven and operate after the ship phase (retro, document-release).
:::

## Pipeline Skills

Full development pipelines that orchestrate multiple phases.

| Skill | What it does |
|-------|-------------|
| [meow:cook](/reference/skills/cook) | End-to-end feature pipeline: plan → test → build → review → ship |
| [meow:fix](/reference/skills/fix) | Structured bug investigation with auto-complexity detection |
| [meow:ship](/reference/skills/ship) | Ship pipeline: merge, test, review, version, commit, PR |
| [meow:workflow-orchestrator](/reference/skills/workflow-orchestrator) | 5-phase TDD workflow with token budgets and fast-track |
| [meow:session-continuation](/reference/skills/session-continuation) | Save/resume workflow state across sessions |

## Quality & Review

Code quality enforcement, review, and security scanning.

| Skill | What it does |
|-------|-------------|
| [meow:review](/reference/skills/review) | Multi-pass code review with adversarial analysis |
| [meow:cso](/reference/skills/cso) | Chief Security Officer — infrastructure-first audit |
| [meow:vulnerability-scanner](/reference/skills/vulnerability-scanner) | OWASP 2025 code-level scanning |
| [meow:clean-code](/reference/skills/clean-code) | Pragmatic coding standards (SRP, DRY, KISS) |
| [meow:lint-and-validate](/reference/skills/lint-and-validate) | Auto-run linters + type checks after changes |

## Planning & Design

Plan creation, review, and ideation.

| Skill | What it does |
|-------|-------------|
| [meow:plan-creator](/reference/skills/plan-creator) | Auto-select plan template by task scope |
| [meow:plan-ceo-review](/reference/skills/plan-ceo-review) | CEO-mode plan review with scope expansion |
| [meow:plan-eng-review](/reference/skills/plan-eng-review) | Engineering plan review — architecture, edges, tests |
| [meow:office-hours](/reference/skills/office-hours) | YC-style brainstorming (startup + builder modes) |
| [meow:brainstorming](/reference/skills/brainstorming) | Structured ideation with scoring + plan-creator handoff |

## Exploration & Research

Codebase exploration, debugging, and documentation retrieval.

| Skill | What it does |
|-------|-------------|
| [meow:scout](/reference/skills/scout) | Parallel codebase exploration via Explore subagents |
| [meow:investigate](/reference/skills/investigate) | Systematic 5-phase root cause debugging |
| [meow:docs-finder](/reference/skills/docs-finder) | Library/project docs via Context7 + Context Hub |
| [meow:sequential-thinking](/reference/skills/sequential-thinking) | Hypothesis-driven reasoning for root cause analysis |

## Browser & QA Testing

Browser automation, QA testing, and E2E code generation.

| Skill | What it does |
|-------|-------------|
| [meow:qa-manual](/reference/skills/qa-manual) | Spec-driven manual QA + Playwright E2E code gen |
| [meow:qa](/reference/skills/qa) | Systematic QA with bug fixing and health scores |
| [meow:browse](/reference/skills/browse) | Fast headless browser (~100ms/command) |
| [meow:agent-browser](/reference/skills/agent-browser) | Chrome/CDP with session persistence and auth |
| [meow:playwright-cli](/reference/skills/playwright-cli) | Playwright MCP with code generation |

## Frontend

TypeScript, Vue, React, and UI/UX design patterns.

| Skill | What it does |
|-------|-------------|
| [meow:typescript](/reference/skills/typescript) | Strict TS: null handling, type guards, utility types |
| [meow:vue](/reference/skills/vue) | Vue 3 Composition API, Pinia, reactivity |
| [meow:angular](/reference/skills/angular) | Angular v20+ patterns — 10 topics consolidated (components, signals, DI, forms, routing, HTTP, SSR, testing, tooling) |
| [meow:react-patterns](/reference/skills/react-patterns) | React/Next.js performance — 45+ rules from Vercel Engineering |
| [meow:frontend-design](/reference/skills/frontend-design) | UI/UX with anti-AI-slop enforcement |
| [meow:ui-design-system](/reference/skills/ui-design-system) | Design intelligence: styles, WCAG 2.1 AA, palettes, quality checklists |

## Analysis & Media

Multimodal analysis and documentation generation.

| Skill | What it does |
|-------|-------------|
| [meow:multimodal](/reference/skills/multimodal) | Image/video/audio/PDF via Gemini API |
| [meow:llms](/reference/skills/llms) | Generate llms.txt per llmstxt.org spec |

## Safety & Scoping

Destructive command prevention and edit restrictions.

| Skill | What it does |
|-------|-------------|
| [meow:careful](/reference/skills/careful) | Warn before rm -rf, DROP TABLE, force-push |
| [meow:freeze](/reference/skills/freeze) | Restrict edits to one directory |
| [meow:skill-template-secure](/reference/skills/skill-template-secure) | Secure template for skills handling untrusted input |

## Infrastructure

Agent detection, loading, skill creation, and project organization.

| Skill | What it does |
|-------|-------------|
| [meow:agent-detector](/reference/skills/agent-detector) | Auto-detect agent + complexity + model per message |
| [meow:lazy-agent-loader](/reference/skills/lazy-agent-loader) | On-demand agent loading for token savings |
| [meow:skill-creator](/reference/skills/skill-creator) | Scaffold + validate + register new skills |
| [meow:project-organization](/reference/skills/project-organization) | File naming, directory structure standards |
| [meow:bootstrap](/reference/skills/bootstrap) | Application scaffold for any stack with progressive generation |

## Documentation & Release

Post-ship docs, retrospectives, and release management.

| Skill | What it does |
|-------|-------------|
| [meow:docs-init](/reference/skills/docs-init) | Generate initial docs from codebase analysis |
| [meow:document-release](/reference/skills/document-release) | Post-ship doc sync — cross-reference diff against docs |
| [meow:retro](/reference/skills/retro) | Sprint retrospective with commit analysis + trends |

## Reference Toolkits

Collections of reference guides loaded by agents during specific phases.

| Skill | What it does |
|-------|-------------|
| [meow:development](/reference/skills/development) | Code patterns, TDD, skill loading (Phase 3) |
| [meow:documentation](/reference/skills/documentation) | Living docs, API sync, changelog (Phase 6) |
| [meow:memory](/reference/skills/memory) | Session capture, patterns, cost tracking (Phase 0, 6) |
| [meow:shipping](/reference/skills/shipping) | Ship pipeline, canary deploy, rollback (Phase 5) |
| [meow:testing](/reference/skills/testing) | Red-green-refactor, validation, visual QA (Phase 2-3) |

## See Also

- [Agent-Skill Architecture](/guide/agent-skill-architecture) — how agents and skills interact across workflow phases
- [Workflow Phases](/guide/workflow-phases) — the 6-phase pipeline from Orient to Reflect
- [Agents Overview](/reference/agents/) — the full agent roster and ownership model
