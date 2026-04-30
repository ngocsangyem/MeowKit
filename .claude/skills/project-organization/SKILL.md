---
name: mk:project-organization
description: "Use when creating files and need the correct path, organizing project layout, or enforcing naming conventions. Two modes: advisory (return path) and organize (restructure)."
argument-hint: "[directories or files to organize]"
source: claudekit-engineer
original_path: .claude/skills/project-organization/SKILL.md
adapted_for: meowkit
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

Operates in **Phase 6 (Reflect)** or advisory mode (called by any skill). Output supports the `documenter` agent.

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
- Use `mk:` prefix conventions for .claude/skills/ directories

## Gotchas

- **Monorepo package `name` in `package.json` and the directory name can diverge silently** — a workspace package at `packages/auth-service/` with `"name": "@company/auth"` is referenced by consumers as `@company/auth`, but path aliases, Docker build contexts, and some bundlers resolve by directory name; mismatch causes "cannot find module" errors that only appear after a fresh install in CI.
- **`tsconfig.json` path aliases are NOT honored by test runners without separate config** — `paths: { "@/*": ["src/*"] }` in `tsconfig.json` resolves in `tsc` and Vite but Vitest and Jest use their own module resolvers; tests using `@/` aliases silently fall through to `node_modules` lookup and fail with "Cannot find module '@/utils'" unless `moduleNameMapper` (Jest) or `alias` (Vitest) is configured separately.
- **Circular path aliases break tree-shaking and cause `undefined` at runtime** — `src/utils/index.ts` re-exporting from `src/components/` which imports from `src/utils/` creates a circular dependency that bundlers resolve non-deterministically; the symptom is a component that is `undefined` when imported via the alias but defined when imported by relative path.
- **Absolute imports (`src/`) vs relative imports (`../../`) inconsistency prevents reliable refactoring** — mixing both styles means automated refactoring tools (VS Code "move file", `ts-morph`) update only the form they recognize; half the import sites break silently on any file move; enforce one style via ESLint `import/no-relative-parent-imports` or `import/no-absolute-path`.
- **`.gitignore` patterns not applying to already-tracked files causes `dist/` to appear in PRs** — if `dist/` was committed before being added to `.gitignore`, git continues tracking it; `git rm -r --cached dist/` is required to untrack it, and omitting this step means every build output change appears as a diff in PRs.
