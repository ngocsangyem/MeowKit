# Changelog

All notable changes to MeowKit are documented here. This file is auto-updated by [semantic-release](https://github.com/semantic-release/semantic-release) on future releases.

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
