---
title: "mk:project-context"
description: "mk:project-context"
---

## What This Skill Does

`mk:project-context` creates and maintains `docs/project-context.md` — the single source of truth for project conventions, tech stack, and anti-patterns. This file acts as an agent "constitution" that every MeowKit agent loads on activation, eliminating context drift where agents independently infer conventions and make conflicting decisions.

For the full documentation suite (README, architecture docs, code standards, etc.), use `mk:docs-init` instead. `mk:project-context` generates only the agent constitution.

## When to Use

- **First time:** After `mk:bootstrap` or `mk:docs-init`
- **After architecture changes:** New framework, new database, major refactor
- **Periodically:** When agents produce inconsistent code (symptom of stale context)
- **Greenfield projects:** Use `init` action to create a TODO skeleton before code exists

## Core Capabilities

### Three Actions

| Action | Behavior | When to Use |
|--------|----------|-------------|
| `generate` | Scan codebase and create `docs/project-context.md` from scratch | Established project with real code |
| `update` | Re-scan codebase and update existing file. Preserves sections marked `<!-- manual -->` | Existing file is stale after architecture changes |
| `init` | Write TODO-placeholder skeleton to `docs/project-context.md` | Empty/near-empty project (<5 source files) |

### `generate` — Full Generation

Scans the codebase for:

| Scan Target | What It Detects |
|-------------|-----------------|
| `package.json` / `Cargo.toml` / `go.mod` / `pyproject.toml` | Tech stack, dependencies, versions |
| `tsconfig.json` / `eslint.*` / `prettier.*` | Code conventions, style rules |
| `**/test/**` / `**/*.test.*` / `**/*.spec.*` / `**/*.cy.*` | Testing patterns, frameworks, conventions |
| Existing `docs/` | Architecture decisions, prior context |
| `.env.example` | Environment variables (names only, never values) |

Output uses `templates/project-context-template.md` as the structure.

### `update` — Incremental Update

Re-scans codebase and refreshes auto-detected sections. Preserves manual edits in sections marked with `<!-- manual -->`. The `<!-- manual -->` marker survives `update` but NOT `generate` — backup before regenerating from scratch.

### `init` — Greenfield Skeleton

Writes a `templates/skeleton.md`-based TODO file with 11 sections:

1. Project Overview
2. Tech Stack (with WHY each was chosen)
3. Architecture
4. Code Conventions
5. Anti-Patterns (DO NOT DO)
6. Testing Approach
7. Environment Variables
8. External Services & Integrations
9. Deployment
10. Known Issues & Workarounds
11. Rejected Alternatives (highest ROI section)

Behavior: refuses to overwrite an existing `docs/project-context.md`. Delete the file manually if you truly want to reset to a blank skeleton.

### Decision Table

| Situation | Action |
|-----------|--------|
| Empty or near-empty project, < 5 source files | `init` — fill manually |
| Established project with real code | `generate` — auto-derive |
| Existing `docs/project-context.md` is stale | `update` — re-scan, preserve manual edits |
| Existing file, but want fresh from scratch | Delete file manually, then `generate` |

### Focus on the Unobvious

The template emphasizes facts agents **cannot infer from code**:

- **WHY** a framework was chosen (not just what it is)
- **Rejected alternatives** ("use Zustand, NOT Redux" — include the reason)
- **Anti-patterns** specific to this project
- **Testing boundaries** (what to unit test vs integration test vs e2e)

### Integration

All MeowKit agents load `docs/project-context.md` in their Required Context section on activation. If the file doesn't exist, agents behave exactly as before (graceful degradation).

### Priority

If `project-context.md` conflicts with `CLAUDE.md`, **CLAUDE.md wins** — it is the higher-priority document.

## Workflow

### `generate` Flow

1. Scan `package.json`/`Cargo.toml`/`go.mod`/`pyproject.toml` for tech stack
2. Scan `tsconfig.json`/`eslint.*`/`prettier.*` for code conventions
3. Scan test directories for testing patterns
4. Read existing `docs/` for architecture decisions
5. Read `.env.example` for environment variable names
6. Write `docs/project-context.md` using `templates/project-context-template.md`
7. Mark template sections for manual editing with `<!-- manual -->`

### `update` Flow

1. Read existing `docs/project-context.md`
2. Re-scan codebase for auto-detectable sections
3. Overwrite auto-detected sections
4. Preserve sections marked `<!-- manual -->`
5. Write updated file

### `init` Flow

1. Check if `docs/project-context.md` exists → refuse if yes
2. Create `docs/` directory if absent
3. Write `templates/skeleton.md` to `docs/project-context.md`

## Usage

```bash
/mk:project-context generate    # Full generation from codebase analysis
/mk:project-context update      # Incremental update after feature work
/mk:project-context init        # Initial skeleton for new projects
```

## Example Prompt

```
/mk:project-context generate

Scans codebase:
- package.json: React 18, TypeScript 5, Vite, Zustand, vitest
- tsconfig.json: strict mode, path aliases
- eslint.config.mjs: flat config, react-hooks plugin
- src/**/*.test.tsx: vitest + @testing-library/react
- .env.example: VITE_API_URL, VITE_AUTH_DOMAIN
- docs/: architecture-decisions.md found

Output: docs/project-context.md with detected tech stack,
testing conventions, and environment variables.
Manual sections left for: Anti-Patterns, Rejected Alternatives,
Project-Specific Conventions.
```

## Common Use Cases

- **Bootstrapping a new MeowKit project** — run after `mk:bootstrap` to create the agent constitution
- **Onboarding new team members** — they read one file to understand all conventions
- **After major refactor** — run `update` to refresh stale auto-detected sections
- **Preventing agent drift** — when two agents suggest conflicting approaches, the constitution resolves it

## Pro Tips

- The "Rejected Alternatives" section has the highest ROI. If you chose Zustand over Redux, say WHY — it prevents agents from re-proposing Redux in future tasks.
- Stale context is worse than no context. Re-run `update` after any major architecture change.
- Don't list every file path — agents can Glob for that. Focus on RULES and CONVENTIONS.
- `<!-- manual -->` sections survive `update` but NOT `generate`. Always backup before regenerating from scratch.
- `init` refuses to overwrite existing files — this is intentional. Delete the file manually if you want a fresh skeleton.
- If `project-context.md` conflicts with `CLAUDE.md`, `CLAUDE.md` wins.