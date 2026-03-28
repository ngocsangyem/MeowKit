---
title: "meow:docs-init"
description: "Generate initial project documentation from codebase analysis — scout, analyze, create docs/."
---

# meow:docs-init

Generate initial project documentation from codebase analysis.

## What This Skill Does

`meow:docs-init` creates a project's `docs/` directory from scratch by scouting the codebase and generating documentation that reflects what actually exists. It fills the gap between `meow:bootstrap` (creates code) and `meow:document-release` (updates existing docs after shipping).

## Core Capabilities

- **Codebase-driven** — scouts first, generates from findings (no hallucinated architecture)
- **Adaptive output** — generates only relevant docs based on what's detected (no deployment guide for libs)
- **Size-aware** — flags files >800 lines, suggests splitting
- **Delegates generation** — spawns docs-manager subagent for actual file creation
- **Scope-appropriate** — small projects get README + summary only; large projects get full doc suite

## When to Use This

::: tip Use meow:docs-init when...
- Project has no `docs/` directory
- `docs/` exists but is empty or stubs
- After `meow:bootstrap` creates a new project
- Onboarding to an undocumented codebase
:::

::: warning Don't use meow:docs-init when...
- Docs already exist and need updating → use [`meow:document-release`](/reference/skills/document-release)
- You need doc reference guides → use [`meow:documentation`](/reference/skills/documentation)
:::

## Usage

```bash
# Initialize docs for current project
/meow:docs-init

# After bootstrapping a new project
/meow:bootstrap my-app
/meow:docs-init
```

## Generated Files

| File | When generated | Audience |
|------|---------------|----------|
| `README.md` | Always (≤300 lines) | External — setup, usage |
| `docs/project-overview.md` | Always | Internal — why it exists, design decisions |
| `docs/codebase-summary.md` | Always | Internal — directory map, entry points |
| `docs/code-standards.md` | Always | Team — conventions, patterns |
| `docs/system-architecture.md` | Always | Team — component diagram, data flow |
| `docs/deployment-guide.md` | If CI/CD or Docker detected | DevOps |
| `docs/design-guidelines.md` | If frontend/UI code detected | Design/Frontend |

::: info Skill Details
**Phase:** Post-bootstrap or standalone
**Used by:** documenter agent
:::

## Gotchas

- **Hallucinating architecture**: always scouts first — generates only from confirmed findings
- **Over-documenting small projects**: <10 files = README + codebase-summary only
- **Stale on first run**: tell user to run `meow:document-release` after each ship

## Related

- [`meow:bootstrap`](/reference/skills/bootstrap) — Creates project code (run docs-init after)
- [`meow:document-release`](/reference/skills/document-release) — Updates docs after shipping
- [`meow:documentation`](/reference/skills/documentation) — Reference toolkit for doc patterns
