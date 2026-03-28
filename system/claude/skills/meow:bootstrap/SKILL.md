---
name: meow:bootstrap
version: 2.0.0
description: |
  Use when creating a new project from scratch — orchestrates the full journey
  from idea to running code. Research → design → scaffold → plan → implement → docs.
  Explicit invocation only — never auto-activates.
  CLI = MeowKit infrastructure (.claude/), bootstrap = application code + full pipeline.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
  - WebSearch
sources:
  - claudekit-engineer
---

# Bootstrap

End-to-end project orchestrator: research → design → scaffold → plan → implement → docs.

**CLI boundary:** `npm create meowkit@latest` = MeowKit infrastructure. `meow:bootstrap` = application code + full pipeline. Zero overlap. Never touch `.claude/`.

## When to Invoke

**Explicit only** — never auto-activate.

```
meow:bootstrap [requirements]
meow:bootstrap [requirements] --full
meow:bootstrap [requirements] --fast
meow:bootstrap [requirements] --parallel
```

Do NOT invoke when: project already has source code, or you only need MeowKit setup (use CLI).

## Modes

| Mode | Flag | Gates | Research | Design | Plan flag | Cook flag |
|------|------|-------|----------|--------|-----------|-----------|
| **Auto** | (default) | Design only | Parallel researchers | UI/UX if frontend | `--auto` | `--auto` |
| **Full** | `--full` | Every step | Parallel researchers | UI/UX if frontend | `--hard` | (interactive) |
| **Fast** | `--fast` | None | 6 parallel batch | Skip | `--fast` | `--auto` |
| **Parallel** | `--parallel` | Design only | Parallel researchers | UI/UX if frontend | `--parallel` | `--parallel` |

## Routing

Parse first flag from arguments:
- `--full` → load `references/workflow-full.md`
- `--fast` → load `references/workflow-fast.md`
- `--parallel` → load `references/workflow-parallel.md`
- default → load `references/workflow-auto.md`

Each workflow file defines the exact steps for that mode. After plan creation, all modes load `references/shared-phases.md` for implementation → docs → final report.

## Scaffolding (Step 4 in all modes)

When generating files, follow `references/scaffolding-principles.md`:
1. Detect stack via `scripts/detect-stack.sh` (or ask user)
2. Generate directory tree first → confirm with user
3. Generate files progressively: config → source → tests
4. Validate with `scripts/validate-bootstrap.sh`
5. Save stack profile to config.json

## Gotchas (top 3)

- **Skipping research on "simple" projects**: projects that seem simple have hidden complexity → always research unless `--fast`
- **Duplicating CLI init**: never generate .claude/ files — CLI handles that
- **Context overflow**: never generate all files at once → progressive generation per scaffolding-principles.md

Full list: `references/gotchas.md`

## Workflow Integration

Pre-workflow. Bootstrap IS the full workflow for new projects:
```
meow:bootstrap → [research → design → scaffold → plan → cook → docs] → done
```

For subsequent features on the same project: use `meow:plan-creator` → `meow:cook` directly.
