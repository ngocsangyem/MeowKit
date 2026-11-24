---
name: mk:docs-init
version: 1.0.0
description: "Generates a project's first docs set. NOT for mk:document-release."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
source: local
phase: on-demand
keywords:
  - docs-init
  - initial-documentation
  - docs-scaffolding
  - new-project-docs
  - codebase-analysis
when_to_use: "No docs exist yet."
user-invocable: true
owner: docs
criticality: medium
status: active
runtime: claude-code
---

# Docs Init

Generate a project's first documentation from codebase analysis, sized to the project. Output is for a human to review and prune.

Not for existing docs: `mk:document-release` syncs them. The agent-constitution file `docs/project-context.md` belongs to `mk:project-context`; run it as well if you want that file.

## When to use

- The project has no `docs/`, or `docs/` is empty or only stubs.
- The user asks to initialize or create documentation.
- After `mk:bootstrap` (a new project needs docs).

If populated docs exist, say so, point to `mk:document-release`, and stop.

## Process

1. **Check state.** Does `docs/` exist and hold real content? If so, stop as above.
2. **Scout.** Use `mk:scout` (or search inline for a small project) to map structure, entry points and config files. Skip `.claude/`, `.git/`, `node_modules/`, `__pycache__/`, `dist/`, `build/`.
3. **Pick the doc set from the project's size and signals:**
   - Small project (fewer than about 10 source files): `README.md` and `docs/codebase-summary.md` only.
   - Otherwise add what the project supports: `docs/project-overview.md` (why it exists, who for), `docs/code-standards.md` (conventions found in the code), `docs/architecture/system-architecture.md` (components, data flow).
   - Only when signal files exist: `docs/deployment-guide.md` (CI/CD, Dockerfile, deploy workflows), `docs/design-guidelines.md` (frontend code).
   README stays at or under 300 lines.
4. **Write the docs.** For a small project, write them inline. Otherwise delegate to the `documenter` agent, or write inline if the host cannot delegate. Brief: goal (first docs set for this project), the scout summary, the list of files from step 3, the constraint "describe only what scout confirmed; no code or implementation", and the return shape (list of files with one line each).
5. **Check.** `wc -l docs/*.md | sort -rn` and flag files over 800 lines. Every command and path a doc states must have appeared in the scout output; list any statement you could not confirm so the user can check it.
6. **Report** the files with line counts, then: "Docs initialized. Run `mk:document-release` after shipping features to keep them in sync."

Do not write code or implementation, only documentation. End with the four-status block from `.claude/rules/agent-conduct.md` (A1).

## Gotchas

The list lives in `references/gotchas.md`; read it before step 4.
