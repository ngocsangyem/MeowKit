---
name: mk:bootstrap
version: 2.1.0
description: "Scaffolds a new project to running code. NOT for mk:autobuild."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - WebSearch
source: local
keywords:
  - bootstrap
  - scaffold
  - new-project
  - initial-scaffolding
  - greenfield-init
when_to_use: "Empty repo."
user-invocable: true
owner: lifecycle
criticality: medium
status: active
runtime: claude-code
---

# Bootstrap

End-to-end project orchestrator: research → design → **plan → scaffold** → implement → docs.

**CLI boundary:** the installer = project infrastructure. `mk:bootstrap` = application code + full pipeline. Zero overlap. Never touch `.claude/`.

## When to Use

**Explicit only** — never auto-activate.

```
mk:bootstrap [requirements]
mk:bootstrap [requirements] --full
mk:bootstrap [requirements] --fast
mk:bootstrap [requirements] --parallel
```

Do not invoke when the project already has source code, or you only need kit setup (use the CLI).
A small utility (fewer than 5 files expected) should use `--fast`.

## Modes

| Mode | Flag | Approvals | Research | Design | Plan flag | Cook flag |
|------|------|-------|----------|--------|-----------|-----------|
| **Auto** | (default) | Design only | Parallel researchers | UI/UX if frontend | `--auto` | `--auto` |
| **Full** | `--full` | Every step | Parallel researchers | UI/UX if frontend | `--hard` | (interactive) |
| **Fast** | `--fast` | None | 1-2 researchers | Skip | `--fast` | `--auto` |
| **Parallel** | `--parallel` | Design only | Parallel researchers | UI/UX if frontend | `--parallel` | `--parallel` |

## Routing

Parse first flag from arguments:
- `--full` → load `references/workflow-full.md`
- `--fast` → load `references/workflow-fast.md`
- `--parallel` → load `references/workflow-parallel.md`
- default → load `references/workflow-auto.md`

Each workflow file lists only what differs for its mode: the approval points, the research fan-out and the plan and cook flags. The steps every mode shares (git init, plan, scaffold, implementation, docs, report) live in `references/shared-phases.md`; load it with the workflow file, and load `references/scaffolding-principles.md` for the scaffold step.

**Run order.** Run the steps in order without pausing, except at the approval points the mode names. Each step's output feeds the next, so stopping between them only loses context.

**Exit.** If research shows the idea is already solved or the stack cannot meet the requirement, stop and ask the user before planning.

## Plan First, Scaffold Second

The plan decides what to scaffold, so every bootstrap writes a plan (`mk:plan-creator`, mode-matched flag) before generating any source file. Full mode may add `mk:plan-ceo-review`.

## Gotchas (top 3)

- **Scaffolding before planning**: generating files without a plan → plan first, scaffold second
- **Skipping research on "simple" projects**: hidden complexity → always research unless `--fast`
- **Duplicating CLI init**: never generate .claude/ files — CLI handles that

Full list: `references/gotchas.md`

## Workflow Integration

Pre-workflow. Bootstrap IS the full workflow for new projects:
```
mk:bootstrap → [research → design → plan → scaffold → cook → docs] → done
```

For subsequent features on the same project: use `mk:plan-creator` → `mk:cook` directly.
