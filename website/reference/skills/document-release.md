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
## Related
- [`meow:ship`](/reference/skills/ship) — Invokes document-release after PR creation
