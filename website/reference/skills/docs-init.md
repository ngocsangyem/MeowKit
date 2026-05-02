---
title: "mk:docs-init"
description: "Generate initial project documentation from codebase analysis — creates docs/ from scratch. For new projects or empty docs directories."
---

# mk:docs-init

Generate initial project documentation from codebase analysis. Creates `docs/` from scratch. For updating existing docs, use `mk:document-release`.

## When to use

- Project has no `docs/` directory
- `docs/` exists but is empty or has only stubs
- User asks "initialize docs", "create documentation", "generate docs"
- After `mk:bootstrap` completes (new project needs docs)

NOT when docs already exist and need updating (use `mk:document-release`).

## Process

1. Check existing state — does `docs/` exist? Are files populated?
2. Scout codebase — identify project type, stack, structure
3. Generate docs skeleton — README, ARCHITECTURE, CONTRIBUTING, project-context
4. Populate — fill with content from codebase analysis

Also run `mk:project-context` to generate the agent-constitution file. `mk:docs-init` generates the full documentation suite; `mk:project-context` generates only the constitution.
