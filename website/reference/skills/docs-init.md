---
title: "mk:docs-init"
description: "Generate initial project documentation from codebase analysis — creates docs/ from scratch. For new projects or empty docs directories."
---

# mk:docs-init — Initial Documentation Generation

## What This Skill Does

Generate initial project documentation from codebase analysis. Creates `docs/` from scratch by scouting the codebase and producing a full documentation suite tailored to the project type.

## When to Use

- Project has no `docs/` directory
- `docs/` exists but is empty or has only stubs
- User asks to "initialize docs", "create documentation", "generate docs"
- After `mk:bootstrap` completes (new project needs docs)

Explicit: `/mk:docs-init`

**Do NOT invoke when:** Docs already exist and need updating (use `mk:document-release`). If populated docs are detected, suggest `mk:document-release` instead and stop.

## Scope

This skill creates `docs/` from scratch. For updating existing docs → `mk:document-release`.

**Also run `mk:project-context`** to generate the agent-constitution file (`docs/project-context.md`). `mk:docs-init` generates the full documentation suite; `mk:project-context` generates only the constitution.

## Core Capabilities

- **Scout-first generation:** Activates `mk:scout` to analyze project structure before generating any docs — prevents hallucination
- **Adaptive output:** Generates only docs relevant to the project type (skips deployment guide for libraries, skips design guidelines for CLI tools)
- **Size awareness:** Checks line counts and flags oversized files (>800 lines)
- **Hard gate:** Never writes code or implementation — only documentation

## Process

1. **Check existing state** — does `docs/` exist? Are files already populated? If populated docs exist → suggest `mk:document-release` instead, stop.
2. **Scout codebase** — activate `mk:scout` to analyze project structure. Skip: `.claude/`, `.git/`, `node_modules/`, `__pycache__/`, `dist/`, `build/`.
3. **Merge findings** — consolidate scout reports into context for doc generation.
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

## Example Prompt

```
Initialize documentation for this project. Scout the codebase and generate a full docs/ suite with project overview, codebase summary, code standards, and system architecture.
```

## Workflow Integration

Runs after `mk:bootstrap` or on any existing project without docs:
