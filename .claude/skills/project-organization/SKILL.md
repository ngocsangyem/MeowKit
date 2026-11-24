---
name: mk:project-organization
description: "Picks path and name for a new file. NOT for mk:docs-init."
argument-hint: '[directories or files to organize]'
source: local
original_path: .claude/skills/project-organization/SKILL.md
adapted_for: claude-code
keywords:
  - project-organization
  - output-organization
  - file-structure
  - plan-organization
  - report-routing
  - directory-layout
when_to_use: "File has no home."
user-invocable: true
owner: docs
criticality: medium
status: active
runtime: claude-code
---

# Project Organization

Standardize file locations, naming conventions, and directory structure for projects.

## When to Use

- Creating a file and need the correct path
- Organizing existing files after a messy session
- Enforcing naming conventions across the project
- Other skills need to know where to save output (advisory mode)

Explicit: `/mk:project-organization [targets]`

## Workflow Integration

Runs when a user invokes it, or in advisory mode when another skill asks where a file belongs. Output supports the `documenter` agent.

## Modes

| Mode         | Trigger                           | Behavior                                   |
| ------------ | --------------------------------- | ------------------------------------------ |
| **Advisory** | Other skills reference this skill | Return correct path + naming for file type |
| **Organize** | User invokes directly             | Scan → propose → confirm → execute         |

## Process (Organize Mode)

1. **Scan + categorize** — list all files, assign each to directory category per `references/directory-rules.md`, check naming conventions
2. **Propose** — present changes as from → to table, ask user approval
3. **Execute + report** — move/rename files, create missing directories, list final structure

## Process (Advisory Mode)

1. Determine file type from context (source? doc? plan? test? asset?)
2. Look up correct path from directory categories
3. Apply naming rules (timestamped / evergreen / variant)
4. Return the path `{path}/{name}.{ext}` and a one-line reason. Advisory mode returns only that; the report table below is for Organize mode.

## Output Format (Organize mode)

```
## Project Organization: {scope}

**Mode:** {advisory | organize}
**Files scanned:** {N}
**Issues found:** {N}

### Changes
| From | To | Reason |
|------|------|--------|
| {old path} | {new path} | {rule violated} |

### Final Structure
{tree view of organized directories}
```

## References

| Reference                                                 | When to load                      | Content                                              |
| --------------------------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| **[directory-rules.md](./references/directory-rules.md)** | Steps 2-4 — categorizing + naming | Directory categories, naming patterns, nesting logic |

## Failure Handling

| Failure                                   | Recovery                             |
| ----------------------------------------- | ------------------------------------ |
| File conflict (target exists)             | Ask user: overwrite, rename, or skip |
| Protected path (.git, .env, node_modules) | Skip silently — never touch          |
| No files found in target                  | Report "No files found in {path}"    |

## Constraints

- Never overwrite an existing file without confirmation: a move that lands on one destroys it.
- Never touch `.git/`, `node_modules/` or `.env` files: they are tool state or secrets.
- Respect `.gitignore`: ignored paths are generated or private.
- Do not move files that other code imports without updating the imports.

## Gotchas

- Reports and plans belong in `tasks/reports/` and `tasks/plans/`, not in `docs/`: `docs/` holds evergreen project documentation.
- Evergreen docs carry no date in their name; timestamped names (`YYMMDD-slug`) are for plans, reviews and reports.
- A file the code imports is not safe to move until its imports are updated; propose the import edits with the move.
- An empty directory needs a `.gitkeep` or git will not track it.
