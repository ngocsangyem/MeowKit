---
title: "mk:bootstrap"
description: "End-to-end project orchestrator — research -> design -> plan -> scaffold -> implement -> docs. For new projects from scratch. Explicit invocation only."
---

# mk:bootstrap

End-to-end project orchestrator for new projects from scratch. Research -> design -> plan -> scaffold -> implement -> docs.

**CLI boundary:** `npx mewkit init` = project infrastructure (`.claude/`). `mk:bootstrap` = application code + full pipeline. Zero overlap. Never touch `.claude/`.

## What This Skill Does

Orchestrates the complete journey from idea to running code for a brand-new project. Handles research, design, planning, file scaffolding, implementation via mk:cook, and documentation generation. Supports 4 execution modes ranging from fully-interactive (`--full`) to fully-automated (`--fast`).

## When to Use

**Explicit invocation only** — never auto-activates.

```
mk:bootstrap [requirements]
mk:bootstrap [requirements] --full
mk:bootstrap [requirements] --fast
mk:bootstrap [requirements] --parallel
```

**Do NOT invoke when:**
- Project already has source code — use `mk:plan-creator` + `mk:cook` directly
- You only need kit setup — use CLI (`npx mewkit init`)
- You need autonomous multi-hour builds of specified products — use `mk:harness`
- You need single-task feature work on existing projects — use `mk:cook`

## Example Prompt

```
Bootstrap a new full-stack SaaS application with a React frontend, Express API, PostgreSQL database, and JWT authentication. Include user registration, role-based access control, and a dashboard with real-time metrics.
```

## Core Capabilities

- **Research** — parallel subagent research on validation, competition, tech stack, design patterns
- **Design** — UI/UX design via `ui-ux-designer` subagent, design guidelines document
- **Planning** — structured plan via `mk:plan-creator` with architecture, modules, file structure
- **Scaffolding** — progressive file generation following naming conventions and dependency order
- **Implementation** — via `mk:cook` with TDD cycle, review, fix-first resolution
- **Documentation** — via `mk:docs-init` generating docs/ directory and README
- **Validation** — post-scaffold validation catching missing files and placeholder leaks

## Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `requirements` | string | Required. Natural language description of what to build |
| `--full` | flag | Maximum user control, gates at every step |
| `--fast` | flag | No user gates, maximum speed, auto-commit |
| `--parallel` | flag | Parallel implementation for independent components |
| (default) | - | Auto mode: balanced, design gate only |

## Modes

| Mode | Flag | Research | Design | Plan Flag | Cook Flag | Git |
|------|------|----------|--------|-----------|-----------|-----|
| **Auto** | (default) | Parallel researchers | UI/UX if frontend | `--auto` | `--auto` | Auto init |
| **Full** | `--full` | Parallel researchers, gate | UI/UX if frontend, gate | `--hard` | (interactive) | Ask user |
| **Fast** | `--fast` | 6 parallel batch, no gate | Skip | `--fast` | `--auto` | Auto init + commit |
| **Parallel** | `--parallel` | Parallel researchers, no gate | UI/UX if frontend, gate | `--parallel` | `--parallel` | Auto init |

## Workflow

Pre-workflow. Bootstrap IS the full workflow for new projects:

```
mk:bootstrap -> [research -> design -> plan -> scaffold -> cook -> docs] -> done
```

For subsequent features on the same project: use `mk:plan-creator` -> `mk:cook` directly.

### Routing

Parse first flag from arguments:
- `--full` -> load `references/workflow-full.md`
- `--fast` -> load `references/workflow-fast.md`
- `--parallel` -> load `references/workflow-parallel.md`
- default -> load `references/workflow-auto.md`

Each workflow file defines the exact steps for that mode. After plan + scaffold, all modes load `references/shared-phases.md` for implementation -> docs -> final report.

## Planning BEFORE Scaffolding

**Plan first, scaffold second.** The plan tells us WHAT to scaffold — planning is NOT optional.

1. **Plan** — invoke `mk:plan-creator` with mode-matched flag. Plan defines: architecture, modules, file structure, acceptance criteria.
2. **Scaffold** — generate files following the plan's architecture + `references/scaffolding-principles.md`. Detect stack via `scripts/detect-stack.sh`. Validate with `scripts/validate-bootstrap.sh`.

Optional: invoke `mk:plan-ceo-review` on the plan (Full mode only).

## Scaffolding Principles

### Directory Structure
1. Separate concerns by directory: `src/`, `tests/`, `docs/`
2. Mirror test structure to source: `src/auth/` -> `tests/auth/`
3. Flat until necessary: don't nest until 5+ files exist at a level
4. Convention over configuration: follow the stack's standard layout

### File Generation
1. **Config files first**: package.json/go.mod before any source
2. **Entry point second**: main.ts/index.ts/main.go
3. **One module at a time**: complete auth/ before moving to users/
4. **Every file must compile**: no placeholder imports
5. **No empty files**: every file has meaningful content

### Progressive Generation

```
Step 1: Print proposed directory tree -> user confirms
Step 2: Generate config files (package.json, tsconfig, etc.)
Step 3: Generate entry point + core module
Step 4: Generate remaining modules (one at a time)
Step 5: Generate test scaffolds matching source structure
Step 6: Generate docs (README.md + code-standards.md only)
```

Between steps: verify no compilation errors before proceeding.

### What NOT to Generate
- `.claude/` directory (CLI handles this)
- `.env` files with real secrets (generate `.env.example` only)
- Lock files (npm install generates these)
- Build output directories (`dist/`, `build/`)
- IDE-specific config (`.vscode/`, `.idea/`) unless user requests

### Minimum Viable Scaffold

```
project/
  src/
    [entry-point]           <- main.ts, index.ts, main.go, etc.
  tests/
    [entry-point.test]      <- matching test file
  [package-manifest]        <- package.json, go.mod, Cargo.toml
  [compiler-config]         <- tsconfig.json, etc. (if applicable)
  .gitignore
  README.md
```

Extend from this minimum based on config.json features (docker, CI, database).

### Naming Convention Enforcement

- **TypeScript/Node**: kebab-case files, camelCase functions, PascalCase classes
- **Vue**: PascalCase components, kebab-case files, `use` prefix for composables
- **NestJS**: `feature.service.ts`, `feature.controller.ts`, `feature.module.ts`
- **Go/Rust**: snake_case files
- **Unknown stack**: ask user for naming conventions before generating

## Mode Details

### Auto (default)

Balanced mode. Research + design gate. Good for most projects.

1. Git init (auto)
2. Research: 2-3 parallel researcher subagents
3. Tech stack: auto-detect or auto-select from research
4. Design: `ui-ux-designer` if frontend, gate: user approves
5. Plan: `mk:plan-creator --auto`
6. Scaffold: guided by plan, auto-confirm
7. Shared phases: cook -> docs -> final report

### Full (`--full`)

Maximum user control. Gates at every major step. For critical projects.

1. Git init: ask user
2. Clarify requirements: one question at a time, 100% clarity
3. Research: 2-4 parallel researchers, gate: user approves summary
4. Tech stack + design: gate for each
5. Plan: `mk:plan-creator --hard` with Gate 1 approval. Optional: `mk:plan-ceo-review`
6. Scaffold: user confirms tree, progressive generation
7. Shared phases: cook (interactive) -> docs -> final report

### Fast (`--fast`)

No user gates. Maximum speed. For prototypes and hackathons.

1. Git init (auto)
2. Combined research + stack: 6 parallel researchers, no gate
3. Plan: `mk:plan-creator --fast`, auto-creates without approval
4. Scaffold: progressive, no user confirmation
5. Shared phases: cook (auto) -> docs -> final report
6. Auto-commit: `git add -A && git commit -m "feat: bootstrap [project-name]"`

### Parallel (`--parallel`)

Design gate only. Parallel implementation for independent components. For large projects.

1. Git init (auto)
2. Research: 2 parallel researchers, no gate
3. Tech stack + design: gate for both
4. Plan: `mk:plan-creator --parallel` with file ownership matrix, dependency graph
5. Scaffold: guided by plan, progressive
6. Shared phases: cook (parallel, multiple developer agents), docs, final report

## Shared Phases (MANDATORY — all modes)

After plan + scaffold, all modes execute these phases:

### Phase A: Implementation
Activate `mk:cook` with mode-matched flag. Handles TDD, implementation, review, fix-first.

### Phase B: Documentation
Activate `mk:docs-init` to generate docs/ directory and README.

### Phase C: Final Report
Print summary and ask about commit.

```
BOOTSTRAP COMPLETE
Project: [name]
Stack: [detected/selected stack]
Files generated: [count]
Plan: [plan path]
Docs: [list of docs/ files]

Next steps:
- Review generated code and docs
- Use mk:plan-creator to plan next feature
- Use mk:document-release after shipping to keep docs in sync
```

## Stack Detection

`scripts/detect-stack.sh` auto-detects project stack from existing project files. Supports 30+ stacks across mobile, systems, Go, Ruby, Java/Kotlin, PHP, Python, and Node.js ecosystems.

## Validation

`scripts/validate-bootstrap.sh` runs post-scaffold checks:
- Basic structure exists (`src/`, `tests/`)
- Source files are not empty
- No placeholder tokens remain (`[TODO]`, `[PROJECT_NAME]`, `[PLACEHOLDER]`)

Exits `BOOTSTRAP_VALID` (0) or `BOOTSTRAP_INCOMPLETE` (1) with error details.

## Gotchas

- **Duplicating CLI init**: generating `.claude/` files that `npx mewkit init` already provides — NEVER touch `.claude/`; bootstrap owns `src/` and `tests/` only
- **Over-scaffolding**: generating 20+ files for a simple project — ask user about scope first; match generated files to actual needs
- **Context overflow on large stacks**: generating NestJS monorepo in one shot — progressive generation: structure first, then one module at a time; verify compilation between steps
- **Wrong naming conventions**: CamelCase files in TypeScript project — always check naming-rules.md for detected stack; ask user if stack is unknown
- **Placeholder leak**: `[PROJECT_NAME]` or `[TODO]` left in generated files — `validate-bootstrap.sh` catches these; fix before declaring BOOTSTRAP_VALID
- **Stale scaffold patterns**: generating patterns from outdated framework versions — use `mk:docs-finder` to check current framework docs before generating
- **Broken imports after generation**: files reference modules that don't exist yet — generate in dependency order; entry point last (it imports everything)
- **Skipping research on "simple" projects**: hidden complexity — always run research unless `--fast` mode
- **Running full pipeline on tiny scripts**: bootstrapping a 50-line utility with full process — detect project size; if <5 files expected, use `--fast` mode automatically

## Tools

| Tool | Path | Purpose |
|------|------|---------|
| Stack detector | `scripts/detect-stack.sh` | Auto-detect project stack from existing files |
| Validator | `scripts/validate-bootstrap.sh` | Post-scaffold structural integrity check |
| Config template | `config.example.json` | Project config with stack, features, conventions |

## Common Use Cases

- Creating a new SaaS application from scratch
- Bootstrapping a microservice with Express/Fastify/NestJS
- Scaffolding a full-stack Next.js + TypeScript project
- Building a CLI tool prototype quickly (`--fast`)
- Large multi-module project with parallel team workflow (`--parallel`)
- Critical production project with stakeholder sign-offs (`--full`)

## Pro Tips

- Always plan before scaffolding — the plan defines WHAT to generate
- Use `--fast` for prototypes (<5 files expected), `--auto` for most projects, `--full` for critical ones
- Progressive generation prevents context overflow on large projects
- Run `validate-bootstrap.sh` after every scaffold — catches placeholder leaks immediately
- Generate in dependency order: config -> core -> modules -> entry point
- The minimum viable scaffold (5 files) is the starting point — extend based on config.json features
