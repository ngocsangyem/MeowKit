---
name: meow:docs-init
version: 1.0.0
description: |
  Use when a project has no docs/ directory or needs initial documentation
  generated from codebase analysis. Triggers on "init docs", "create documentation",
  "generate docs", "docs init", or when docs/ is empty. Do NOT use for updating
  existing docs (use meow:document-release).
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
sources:
  - claudekit-engineer/docs
---

# Docs Init

Generate initial project documentation from codebase analysis.

**Scope:** Creates `docs/` from scratch. For updating existing docs → `meow:document-release`.

## When to Invoke

- Project has no `docs/` directory
- `docs/` exists but is empty or has only stubs
- User asks to "initialize docs", "create documentation", "generate docs"
- After `meow:bootstrap` completes (new project needs docs)

Do NOT invoke when: docs already exist and need updating (use `meow:document-release`).

## Process

1. **Check existing state** — does `docs/` exist? Are files already populated?
   - If populated docs exist → suggest `meow:document-release` instead, stop.
2. **Scout codebase** — activate `meow:scout` to analyze project structure.
   Skip: `.claude/`, `.git/`, `node_modules/`, `__pycache__/`, `dist/`, `build/`
3. **Merge findings** — consolidate scout reports into context for doc generation
4. **Generate docs** — spawn `documenter` subagent via Task tool with scout context.
   Output files (adapt to what the project actually has):
   - `README.md` — project overview (≤300 lines)
   - `docs/project-overview.md` — what this project is, who it's for
   - `docs/codebase-summary.md` — directory map, key modules, entry points
   - `docs/code-standards.md` — conventions found in codebase
   - `docs/system-architecture.md` — component diagram, data flow
   Optional (generate only if relevant):
   - `docs/deployment-guide.md` — if CI/CD or Docker config detected
   - `docs/design-guidelines.md` — if frontend/UI code detected
5. **Size check** — run `wc -l docs/*.md | sort -rn`. Flag files >800 lines.
6. **Report** — print generated files list with line counts.

**Hard gate:** Do NOT write code or implementation. Only documentation.

## Gotchas

- **Hallucinating architecture**: generating docs about code that doesn't exist → always scout FIRST, generate from findings only
- **Over-documenting small projects**: creating 7 docs for a 50-line script → check project size; small projects get README + codebase-summary only
- **Stale on first run**: docs describe initial state but drift immediately → tell user to run `meow:document-release` after each feature ship

Full list: `references/gotchas.md`

## Workflow Integration

Runs after `meow:bootstrap` or on any existing project without docs.
```
meow:bootstrap → meow:docs-init → meow:plan-creator (first feature)
```

Also invoked standalone: `meow:docs-init` on existing undocumented project.

## Handoff Protocol

On completion:
- Print generated files list + line counts
- "Docs initialized. Run `meow:document-release` after shipping features to keep them in sync."
