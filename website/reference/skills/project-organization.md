---
title: "mk:project-organization"
description: "Standardize file locations, naming conventions, and directory structure. Two modes: advisory (return correct path) and organize (restructure)."
---

# mk:project-organization — File & Directory Organization

## What This Skill Does

Standardizes file locations, naming conventions, and directory structure. Operates in two modes: advisory (return the correct path for a given file type) and organize (restructure existing files to match conventions).

## When to Use

- Creating a file and need to know the correct path
- Organizing existing files after a messy session
- Enforcing naming conventions across the project
- Other skills need to know where to save output (advisory mode)

Explicit: `/mk:project-organization [targets]`

**Skip when:** The project already has strongly enforced lint rules and CI checks for file placement — this skill is for projects without automated enforcement.

## Core Capabilities

- **Advisory mode:** Given a file type (source, test, doc, plan, asset, config), returns the correct directory path and naming convention. Used passively by other skills.
- **Organize mode:** Scans target directories, categorizes each file, proposes changes (from → to table), asks user approval, then executes moves/renames.
- **Directory rules engine:** Consults `references/directory-rules.md` for category assignment, naming patterns (timestamped/evergreen/variant), and nesting logic.

## Example Prompt

```
Organize my project files — plans should go in tasks/plans/, reviews in tasks/reviews/, and docs in docs/. Show me the proposed changes before moving anything.
```

## Modes

| Mode | Trigger | Behavior |
|---|---|---|
| **Advisory** | Other skills reference this skill | Return correct path + naming for file type |
| **Organize** | User invokes directly | Scan → propose → confirm → execute |

## Workflow: Organize Mode

1. **Scan + categorize** — list all files in target, assign each to directory category per `references/directory-rules.md`, check naming conventions.
2. **Propose** — present changes as a from → to table, ask user approval via `AskUserQuestion`.
3. **Execute + report** — move/rename files, create missing directories, list final structure as tree.

## Workflow: Advisory Mode

1. Determine file type from context (source? doc? plan? test? asset? config? kit?).
2. Look up correct path from directory categories (see Path Resolution Decision Tree below).
3. Apply naming rules (timestamped for plans/reviews, evergreen for stable docs, variant for multiple versions).
4. Return: `{path}/{name}.{ext}`.

## Path Resolution Decision Tree
