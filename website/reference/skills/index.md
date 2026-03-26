---
title: Skills Overview
description: "All 42 MeowKit skills organized by category."
persona: C
---

# Skills Overview

MeowKit ships 42 skills using the `meow:` namespace prefix. Each skill's SKILL.md stays under ~100 lines as a compact decision router, with detailed procedures in `references/` loaded on demand.

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

## Exploration & Research

Codebase exploration, debugging, and documentation retrieval.

| Skill | What it does |
|-------|-------------|
| [meow:scout](/reference/skills/scout) | Parallel codebase exploration via Explore subagents |
| [meow:investigate](/reference/skills/investigate) | Systematic 5-phase root cause debugging |
| [meow:docs-finder](/reference/skills/docs-finder) | Library/project docs via Context7 + Context Hub |

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

TypeScript, Vue, and UI/UX design patterns.

| Skill | What it does |
|-------|-------------|
| [meow:typescript](/reference/skills/typescript) | Strict TS: null handling, type guards, utility types |
| [meow:vue](/reference/skills/vue) | Vue 3 Composition API, Pinia, reactivity |
| [meow:frontend-design](/reference/skills/frontend-design) | UI/UX with anti-AI-slop enforcement |

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

## Documentation & Release

Post-ship docs, retrospectives, and release management.

| Skill | What it does |
|-------|-------------|
| [meow:document-release](/reference/skills/document-release) | Post-ship doc sync — cross-reference diff against docs |
| [meow:retro](/reference/skills/retro) | Sprint retrospective with commit analysis + trends |

## Reference Toolkits

Collections of reference guides loaded by agents during specific phases.

| Skill | What it does |
|-------|-------------|
| [meow:development](/reference/skills/development) | Code patterns, TDD, skill loading (Phase 3) |
| [meow:documentation](/reference/skills/documentation) | Living docs, API sync, changelog (Phase 6) |
| [meow:memory](/reference/skills/memory) | Session capture, patterns, cost tracking (Phase 0, 6) |
| [meow:planning](/reference/skills/planning) | Plan templates, premise challenge, ADRs (Phase 1) |
| [meow:shipping](/reference/skills/shipping) | Ship pipeline, canary deploy, rollback (Phase 5) |
| [meow:testing](/reference/skills/testing) | Red-green-refactor, validation, visual QA (Phase 2-3) |
