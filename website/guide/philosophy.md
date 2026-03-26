---
title: Philosophy
description: MeowKit's design principles and architectural decisions.
persona: B
---

# Philosophy

## Core thesis

AI agents need enforced discipline — hard gates, TDD, security scanning, and human approval — to ship production-quality code. Without structure, agents skip tests, ignore security, and ship untested code.

## Six core principles

### 1. Security is non-negotiable

Scans run on every write, every review, every ship. The `post-write.sh` hook automatically scans every file write for hardcoded secrets, SQL injection, XSS, and destructive patterns. No mode can disable security checks.

### 2. TDD is enforced

Failing tests must exist before implementation begins. The `pre-implement.sh` hook blocks any attempt to write implementation code without a corresponding failing test. This isn't a suggestion — it's a gate.

### 3. Two human gates

Gate 1 (plan approved) and Gate 2 (review approved) require explicit human sign-off. No `--skip-gates` flag exists by design. The agent cannot self-approve.

### 4. Learn from every session

The memory system (`memory/lessons.md` + `memory/patterns.json`) captures patterns, mistakes, and costs. Every session reads lessons at start and updates them at end. After 10 sessions, the analyst agent proposes CLAUDE.md improvements.

### 5. Load only what's needed

Skills activate by task domain, not all at once. Each skill's SKILL.md is a compact decision router (≤100 lines), with detailed procedures in `references/` loaded on demand. This progressive disclosure pattern saves ~70% context per invocation.

### 6. Cost-aware routing

Trivial tasks use cheap models (Haiku), complex tasks use the best (Opus). The orchestrator declares complexity before every task: `Task complexity: [tier] → using [model]`.

## What MeowKit does NOT do

- **No proprietary formats** — standard Markdown, readable by any tool
- **No telemetry** — all data stays project-local in `.claude/memory/`
- **No experimental features** — everything shipped is production-ready
- **No external services** — zero dependencies on third-party APIs for core workflow
