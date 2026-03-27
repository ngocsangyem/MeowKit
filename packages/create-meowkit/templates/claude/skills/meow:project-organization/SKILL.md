---
name: meow:project-organization
description: "Use when creating files and need the correct path, organizing project layout, or enforcing naming conventions. Two modes: advisory (return path) and organize (restructure)."
argument-hint: "[directories or files to organize]"
source: claudekit-engineer
original_path: .claude/skills/project-organization/SKILL.md
adapted_for: meowkit
source: claukit-engineer
---

# Project Organization

Standardize file locations, naming conventions, and directory structure for MeowKit projects.

## When to Invoke

- Creating a file and need the correct path
- Organizing existing files after a messy session
- Enforcing naming conventions across the project
- Other skills need to know where to save output (advisory mode)

Explicit: `/meow:project-organization [targets]`

## Workflow Integration

Operates in **Phase 6 (Reflect)** or advisory mode (called by any skill). Output supports the `documenter` agent.

## Modes

| Mode         | Trigger                           | Behavior                                   |
| ------------ | --------------------------------- | ------------------------------------------ |
| **Advisory** | Other skills reference this skill | Return correct path + naming for file type |
| **Organize** | User invokes directly             | Scan → propose → confirm → execute         |

## Process (Organize Mode)

1. **Scan** — list all files in target directories
2. **Categorize** — assign each file to a directory category (see `references/directory-rules.md`)
3. **Check naming** — verify kebab-case, self-documenting names
4. **Propose** — present changes as from → to table
5. **Confirm** — ask user approval before any moves
6. **Execute** — move/rename files, create missing directories
7. **Report** — list final structure

## Process (Advisory Mode)

1. Determine file type from context (source? doc? plan? test? asset?)
2. Look up correct path from directory categories
3. Apply naming rules (timestamped / evergreen / variant)
4. Return: `{path}/{name}.{ext}`

## Output Format

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

- Never overwrite existing files without confirmation
- Never touch `.git/`, `node_modules/`, `.env` files
- Respect `.gitignore` patterns
- Use `meow:` prefix conventions for .claude/skills/ directories
