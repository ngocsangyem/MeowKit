---
title: "meow:document-release"
description: "Post-ship documentation sync — reads all project docs, cross-references the diff, and updates everything to match what shipped."
---
# meow:document-release
Post-ship documentation sync — reads all project docs, cross-references the diff, and updates everything to match what shipped.
## What This Skill Does
After a PR is merged or code is shipped, this skill reads all project documentation, cross-references against the git diff, and updates: README, ARCHITECTURE, CONTRIBUTING, CLAUDE.md, TODOS, CHANGELOG. Polishes changelog voice and optionally bumps VERSION. Runs automatically as part of `/meow:ship`.
## Core Capabilities
- **Diff-aware updates** — Only touches docs affected by the changes
- **Cross-reference** — Verifies docs match actual implementation
- **Changelog polish** — Ensures consistent voice and categorization
- **TODOS cleanup** — Marks completed items, removes stale entries
- **Version bump** — Optional VERSION file increment
## Usage
```bash
/meow:docs-sync              # trigger manually
# Also runs automatically as Step 8.5 of /meow:ship
```
::: info Skill Details
**Phase:** 6  
**Used by:** documenter agent  
**Plan-First Gate:** Scopes from diff — plans only for major doc restructures.
:::

## Gotchas

- **CHANGELOG voice inconsistency**: Mixing first-person and third-person across entries → Always use imperative mood: "Add feature" not "Added feature" or "I added feature"
- **README links to deleted files**: Refactored paths not updated in documentation → Run link checker after doc updates; grep for old paths

## Related
- [`meow:ship`](/reference/skills/ship) — Invokes document-release after PR creation
