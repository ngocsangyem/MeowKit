---
title: Changelog
description: MeowKit release history and changes.
---

# Changelog

## 0.1.2 (2026-03-29)

### Features

- Interactive version selection when running `npm create meowkit@latest`
- Add `git-manager` agent for commit/push operations with conventional commits
- Add README.md for both npm packages (`create-meowkit`, `meowkit-cli`)
- Add CHANGELOG.md and VitePress changelog page
- Add Resources dropdown in VitePress nav

### Documentation

- Rewrite root README.md — project description, package table, release guide
- Update VitePress CLI docs — `--list` flag, beta channel, GitHub-download model
- Rewrite `create-meowkit` docs for GitHub-download architecture

## 0.1.1 (2026-03-29)

### Bug Fixes

- Exclude runtime dirs (session-state, memory, logs) from release zip
- Exclude `.claude/metadata.json` and `.claude/.env` from release artifacts
- Add `.claude/session-state/` to `.gitignore`

## 0.1.0 (2026-03-29)

### Features

- Initial release of MeowKit AI agent toolkit
- 49 skills with `meow:` namespace
- 14 specialist agents (orchestrator, planner, developer, reviewer, etc.)
- 18 slash commands
- 7 behavioral modes (default, strict, fast, architect, audit, document, cost-saver)
- 14 enforcement rules (security, TDD, gates, injection defense)
- 6 lifecycle hooks (post-write security scan, post-session memory capture)
- 4-layer prompt injection defense
- Cross-session memory system
- `create-meowkit` CLI — downloads releases from GitHub, scaffolds `.claude/`
- `meowkit-cli` runtime — upgrade, doctor, validate, budget, memory, status
- Smart update with SHA-256 checksum manifest (preserves user modifications)
- Semantic-release automation with dual channels (main=stable, dev=beta)
- GitHub Actions CI/CD (release, beta, PR validation)
- Version listing (`--list`), beta channel support (`--beta`)
