---
name: mk:project-context
description: "Generates docs/project-context.md. NOT for mk:docs-init."
triggers:
  - generate context
  - project context
actions:
  - generate
  - update
  - init
argument-hint: '[generate|update|init]'
source: local
keywords:
  - project-context
  - agent-constitution
  - tech-stack
  - conventions
  - anti-patterns
  - docs-init
when_to_use: "The context file is stale."
user-invocable: true
owner: docs
criticality: medium
status: active
runtime: claude-code
---

# Project Context Generator

Creates `docs/project-context.md` — the agent "constitution" that every agent loads on activation.

> The full documentation suite (README, architecture, code standards) is `mk:docs-init`'s job; this skill owns only `docs/project-context.md`. Report the outcome with the four-status block from `.claude/rules/agent-conduct.md` (A1).

## Purpose

Eliminate context drift between agents. Without a single authoritative file, agents infer conventions independently and make conflicting decisions. Project context solves this by providing one document all agents read first.

## Actions

All three actions use `templates/project-context-template.md`.

### generate

Scan the codebase and write `docs/project-context.md` with only what a scan cannot show: rejected alternatives, anti-patterns, testing boundaries, conventions the tooling does not enforce, known issues. Do not fill in the tech stack, directory layout or dependency versions: agents read those from the code. A scan can fill the command table (from `package.json` scripts, `Makefile`, `Cargo.toml` and similar) and suggest candidates for the rest; leave every judgment section as a `[TODO]` prompt for a human unless the repo itself states the answer (a README, an ADR, a comment that gives a reason). Scan targets: manifests and lint configs for commands, test files for testing patterns, existing `docs/` for decisions already recorded, `.env.example` for variable names only.

The result is a draft. Tell the user to prune it, because a generated context file that restates the code costs agents attention and teaches them nothing.

If the scan finds almost nothing (a near-empty project), write the template with its `[TODO]` prompts and say so; that is the `init` outcome.

### update

Re-scan and update the existing file, preserving every section marked `<!-- manual -->`. If a manual section contradicts what the scan now shows, flag it rather than overwriting it.

### init

Write the template to `docs/project-context.md`, creating `docs/` if needed. Refuse if the file already exists and point to `update`; the refusal is intentional, delete the file by hand to reset.

| Situation | Action |
| --- | --- |
| Empty or near-empty project (fewer than about 5 source files) | `init`, then fill by hand |
| Established project with real code | `generate` |
| Existing file is stale | `update` |

## When to Run

- **First time:** After `mk:bootstrap` or `mk:docs-init`
- **After architecture changes:** New framework, new database, major refactor
- **Periodically:** When agents produce inconsistent code (symptom of stale context)

## Gotchas

- Stale context is worse than no context — re-run `update` after major architecture changes
- The template asks for "rejected alternatives" — this is the highest-value content. If you chose Zustand over Redux, say WHY
- Do not list file paths or stack versions: agents can search for those. Rules and reasons only
- `<!-- manual -->` sections survive `update` but not `generate`: back the file up before regenerating
- If project-context.md conflicts with CLAUDE.md, CLAUDE.md wins (it's the higher-priority document)

## Integration

All agents load `docs/project-context.md` in their Required Context section. If the file doesn't exist, agents behave exactly as before (graceful degradation).

## Files in this skill

- `SKILL.md` — you are here
- `templates/project-context-template.md` — the one template for `init`, `generate` and `update`
