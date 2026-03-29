---
name: meow:project-context
description: >-
  Generate or update docs/project-context.md — the single source of truth
  for project conventions, tech stack, and anti-patterns. Loaded by all
  agents as a "constitution" to ensure consistent behavior.
triggers:
  - generate context
  - project context
  - init docs
actions:
  - generate
  - update
argument-hint: "[generate|update]"
source: meowkit
---

# Project Context Generator

Creates `docs/project-context.md` — the agent "constitution" that every MeowKit agent loads on activation.

## Purpose

Eliminate context drift between agents. Without a single authoritative file, agents infer conventions independently and make conflicting decisions. Project context solves this by providing one document all agents read first.

## Actions

### generate

Scan the codebase and create `docs/project-context.md` from scratch.

**Scan targets:**

- `package.json` / `Cargo.toml` / `go.mod` / `pyproject.toml` → tech stack
- `tsconfig.json` / `eslint.*` / `prettier.*` → code conventions
- `**/test/**` / `**/*.test.*` / `**/*.spec.*` / `**/*.cy.*` → testing patterns
- Existing `docs/` → architecture decisions, prior context
- `.env.example` → environment variables (names only, not values)

**Output:** `docs/project-context.md` using `templates/project-context-template.md`

### update

Re-scan codebase and update existing `docs/project-context.md`. Preserves manual edits in sections marked `<!-- manual -->`.

## When to Run

- **First time:** After `meow:bootstrap` or `meow:docs-init`
- **After architecture changes:** New framework, new database, major refactor
- **Periodically:** When agents produce inconsistent code (symptom of stale context)

## Focus on the Unobvious

The template emphasizes facts agents **cannot infer from code**:

- WHY a framework was chosen (not just what it is)
- Rejected alternatives ("use Zustand, NOT Redux")
- Anti-patterns specific to this project
- Testing boundaries (what to unit test vs e2e)

## Template

See `templates/project-context-template.md` for the full structure.

## Integration

All 15 MeowKit agents load `docs/project-context.md` in their Required Context section. If the file doesn't exist, agents behave exactly as before (graceful degradation).
