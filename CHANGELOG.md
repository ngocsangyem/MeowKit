# Changelog

All notable changes to MeowKit are documented here. This file is auto-updated by [semantic-release](https://github.com/semantic-release/semantic-release) on future releases.

## [1.2.1](https://github.com/ngocsangyem/MeowKit/releases/tag/v1.2.1) (2026-03-31)

### Bug Fixes

- **memory capture at Phase 6 now enforced** — `meow:cook` Phase 6 (Reflect) now spawns a dedicated subagent for `meow:memory` session-capture, matching the same MUST-spawn enforcement as project-manager and docs-manager. Previously memory write was a bullet point instruction that could be skipped if session was interrupted.

## [1.2.0](https://github.com/ngocsangyem/MeowKit/releases/tag/v1.2.0) (2026-03-31)

### Features

- **memory capture pipeline** — fixed Stop hook to write structured NEEDS_CAPTURE markers instead of HTML comment placeholders
- **retroactive capture** — Phase 0 now processes pending capture markers from previous sessions (max 3, 2-min budget)
- **live capture** — Phase 5 captures non-obvious decisions, corrections, and rejected approaches before shipping
- **3-category extraction** — session learnings captured as patterns, decisions, or failures (inspired by Khuym compounding)
- **enriched patterns.json** — new optional fields: `category`, `severity`, `applicable_when` (backward compatible)
- **stronger promotion criteria** — patterns promoted to CLAUDE.md only when: frequency ≥ 3, severity = critical OR frequency ≥ 5, generalizable, saves ≥ 30 min
- **consolidation rubric** — new `consolidation.md` reference with 4-branch classification (clear match/ambiguous/no match/no durable signal)
- **memory-system.md** — comprehensive developer guide covering architecture, activation, FAQ, limitations, migration

### Documentation

- new VitePress page: v1.2.0 — The Memory Activation Release
- rewrote memory-system guide with capture pipeline, schema reference, consolidation triggers
- updated workflow-phases: Phase 0 retroactive capture, Phase 5 live capture, Phase 6 3-category extraction
- updated analyst agent reference with new capabilities
- updated memory skill reference with consolidation + schema notes
- added deferred status to auto-dream-reference.md with cross-framework research summary

### Research

- dream feature confirmed in Claude Code binary (v2.1.83) but NOT officially documented by Anthropic — deferred for MeowKit

## [1.1.0](https://github.com/ngocsangyem/MeowKit/releases/tag/v1.1.0) (2026-03-30)

### Features

- **meow:elicit** — structured second-pass reasoning with 8 methods (pre-mortem, inversion, red team, Socratic, first principles, constraint removal, stakeholder mapping, analogical)
- **meow:validate-plan** — 8-dimension plan quality validation (scope, criteria, dependencies, risks, architecture, tests, security, effort)
- **meow:nyquist** — test-to-requirement coverage mapping with gap detection
- **beads pattern** — atomic resumable work units for COMPLEX builds (5+ files), tracked in session-state
- **subagent status protocol** — structured DONE/DONE_WITH_CONCERNS/BLOCKED/NEEDS_CONTEXT reporting
- **sub-agent type classification** — advisory/utility/escalation in support agent frontmatter
- **delegation checklist** — pre-delegation template in orchestration-rules with anti-patterns
- **enforcement mechanism matrix** — rule→mechanism→override mapping in RULES_INDEX
- **SKILLS_INDEX.md** — centralized registry of all 60 skills by phase/owner/type
- **AGENTS_INDEX.md** — Type column (Core/Support), added ui-ux-designer
- **scout + elicit integration** — review pipeline enhanced with pre-review scouting and post-verdict elicitation
- **bead template** — tasks/templates/bead-template.md for plan decomposition
- **VitePress docs** — 3 new skill reference pages, 9 updated pages with Mermaid diagrams

### Documentation

- updated agent-skill-architecture guide with quick-start table and updated Mermaid diagram
- updated workflow-phases guide with v1.1.0 skill annotations
- updated whats-new page with full v1.1.0 release section
- updated reviewer, planner, developer agent reference pages

## [1.0.0](https://github.com/ngocsangyem/MeowKit/releases/tag/v1.0.0) (2026-03-30)

### Features

- initial release of MeowKit AI agent toolkit
- 49 skills with `meow:` namespace
- 14 specialist agents (orchestrator, planner, developer, reviewer, etc.)
- 18 slash commands
- 7 behavioral modes (default, strict, fast, architect, audit, document, cost-saver)
- 14 enforcement rules (security, TDD, gates, injection defense)
- 6 lifecycle hooks (post-write security scan, post-session memory capture)
- 4-layer prompt injection defense
- cross-session memory system
- `create-meowkit` CLI — downloads releases from GitHub, scaffolds `.claude/`
- `mewkit` runtime — upgrade, doctor, validate, budget, memory, status
- smart update with SHA-256 checksum manifest (preserves user modifications)
- interactive version selection when running `npm create meowkit@latest`
- confirmation step before Gemini API key input
- semantic-release automation with dual channels (main=stable, dev=beta)
- GitHub Actions CI/CD (release, beta, PR validation)
- version listing (`--list`), beta channel support (`--beta`)

### Bug Fixes

- exclude runtime dirs (session-state, memory, logs) from release zip
- exclude `.claude/metadata.json` and `.claude/.env` from release artifacts
- fix typecheck to run per workspace for correct module resolution

## [0.1.2](https://github.com/ngocsangyem/MeowKit/releases/tag/v0.1.2) (2026-03-29)

### Features

- interactive version selection when running `npm create meowkit@latest`
- git-manager agent for commit/push workflows
- confirmation step before Gemini API key input

## [0.1.1](https://github.com/ngocsangyem/MeowKit/releases/tag/v0.1.1) (2026-03-29)

### Bug Fixes

- exclude runtime dirs (session-state, memory, logs) from release zip and git tracking

## [0.1.0](https://github.com/ngocsangyem/MeowKit/releases/tag/v0.1.0) (2026-03-29)

### Features

- initial pre-release of MeowKit agent toolkit
- core skill set (cook, fix, ship, review, memory, testing)
- sequential thinking and fix diagnosis references
- prepare-release-assets script for GitHub Release packaging
