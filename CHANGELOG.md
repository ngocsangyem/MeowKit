# Changelog

All notable changes to MeowKit are documented here. This file is auto-updated by [semantic-release](https://github.com/semantic-release/semantic-release) on future releases.

## [1.1.0](https://github.com/ngocsangyem/MeowKit/releases/tag/v1.1.0) (2026-03-30)

### Features

* **meow:elicit** — structured second-pass reasoning with 8 methods (pre-mortem, inversion, red team, Socratic, first principles, constraint removal, stakeholder mapping, analogical)
* **meow:validate-plan** — 8-dimension plan quality validation (scope, criteria, dependencies, risks, architecture, tests, security, effort)
* **meow:nyquist** — test-to-requirement coverage mapping with gap detection
* **beads pattern** — atomic resumable work units for COMPLEX builds (5+ files), tracked in session-state
* **subagent status protocol** — structured DONE/DONE_WITH_CONCERNS/BLOCKED/NEEDS_CONTEXT reporting
* **sub-agent type classification** — advisory/utility/escalation in support agent frontmatter
* **delegation checklist** — pre-delegation template in orchestration-rules with anti-patterns
* **enforcement mechanism matrix** — rule→mechanism→override mapping in RULES_INDEX
* **SKILLS_INDEX.md** — centralized registry of all 60 skills by phase/owner/type
* **AGENTS_INDEX.md** — Type column (Core/Support), added ui-ux-designer
* **scout + elicit integration** — review pipeline enhanced with pre-review scouting and post-verdict elicitation
* **bead template** — tasks/templates/bead-template.md for plan decomposition
* **VitePress docs** — 3 new skill reference pages, 9 updated pages with Mermaid diagrams

### Documentation

* updated agent-skill-architecture guide with quick-start table and updated Mermaid diagram
* updated workflow-phases guide with v1.1.0 skill annotations
* updated whats-new page with full v1.1.0 release section
* updated reviewer, planner, developer agent reference pages

## [1.0.0](https://github.com/ngocsangyem/MeowKit/releases/tag/v1.0.0) (2026-03-30)

### Features

* initial release of MeowKit AI agent toolkit
* 49 skills with `meow:` namespace
* 14 specialist agents (orchestrator, planner, developer, reviewer, etc.)
* 18 slash commands
* 7 behavioral modes (default, strict, fast, architect, audit, document, cost-saver)
* 14 enforcement rules (security, TDD, gates, injection defense)
* 6 lifecycle hooks (post-write security scan, post-session memory capture)
* 4-layer prompt injection defense
* cross-session memory system
* `create-meowkit` CLI — downloads releases from GitHub, scaffolds `.claude/`
* `mewkit` runtime — upgrade, doctor, validate, budget, memory, status
* smart update with SHA-256 checksum manifest (preserves user modifications)
* interactive version selection when running `npm create meowkit@latest`
* confirmation step before Gemini API key input
* semantic-release automation with dual channels (main=stable, dev=beta)
* GitHub Actions CI/CD (release, beta, PR validation)
* version listing (`--list`), beta channel support (`--beta`)

### Bug Fixes

* exclude runtime dirs (session-state, memory, logs) from release zip
* exclude `.claude/metadata.json` and `.claude/.env` from release artifacts
* fix typecheck to run per workspace for correct module resolution
