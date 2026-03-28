---
title: "meow:project-organization"
description: "Standardize file locations, naming conventions, and directory structure with advisory and organize modes."
---
# meow:project-organization
Standardize file locations, naming conventions, and directory structure with advisory and organize modes.
## What This Skill Does
Two modes: **Advisory** (other skills ask "where should I put this file?" and get the correct path) and **Organize** (scan a directory, propose renames/moves, execute after confirmation). Enforces kebab-case naming, timestamped vs evergreen patterns, and MeowKit's directory conventions.
## Core Capabilities
- **Advisory mode** — Return correct path + naming for any file type
- **Organize mode** — Scan → categorize → propose → confirm → execute
- **Directory rules** — src/, docs/, tasks/, tests/, assets/, .claude/
- **Naming patterns** — Timestamped (YYMMDD-slug), evergreen (slug), variant (slug-variant)
- **Safety** — Never touches .git/, node_modules/, .env files
## Usage
```bash
/meow:project-organization docs/     # organize docs directory
"where should I put this report?"    # advisory mode
```
::: info Skill Details
**Phase:** any
:::

## Related
- [`meow:clean-code`](/reference/skills/clean-code) — Code-level standards
