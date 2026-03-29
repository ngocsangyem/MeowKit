# Changelog

All notable changes to MeowKit are documented here. This file is auto-updated by [semantic-release](https://github.com/semantic-release/semantic-release) on future releases.

## [0.1.2](https://github.com/ngocsangyem/MeowKit/releases/tag/v0.1.2) (2026-03-29)

### Features

* interactive version selection when running `npm create meowkit@latest`
* add `git-manager` agent for commit/push operations with conventional commits
* add README.md for both npm packages (`create-meowkit`, `meowkit-cli`)
* add CHANGELOG.md and VitePress changelog page
* add Resources dropdown in VitePress nav (changelog, GitHub releases, npm links)

### Documentation

* rewrite root README.md — project description, package table, release guide
* update VitePress CLI docs — `--list` flag, beta channel, GitHub-download model
* rewrite `create-meowkit` docs for GitHub-download architecture

## [0.1.1](https://github.com/ngocsangyem/MeowKit/releases/tag/v0.1.1) (2026-03-29)

### Bug Fixes

* exclude runtime dirs (session-state, memory, logs) from release zip
* exclude `.claude/metadata.json` and `.claude/.env` from release artifacts
* add `.claude/session-state/` to `.gitignore`

## [0.1.0](https://github.com/ngocsangyem/MeowKit/releases/tag/v0.1.0) (2026-03-29)

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
* `meowkit-cli` runtime — upgrade, doctor, validate, budget, memory, status
* smart update with SHA-256 checksum manifest (preserves user modifications)
* semantic-release automation with dual channels (main=stable, dev=beta)
* GitHub Actions CI/CD (release, beta, PR validation)
* version listing (`--list`), beta channel support (`--beta`)
