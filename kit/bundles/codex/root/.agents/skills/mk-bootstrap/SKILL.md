---
name: "mk-bootstrap"
description: "Bootstraps a new project end to end: research, design, plan, scaffold, implement, docs. Explicit invocation only. NOT for autonomous builds (mk:autobuild); NOT for existing-repo work (mk:cook)."
---

# Bootstrap

End-to-end project orchestrator: research → design → **plan → scaffold** → implement → docs.

**CLI boundary:** the installer = project infrastructure. `mk:bootstrap` = application code + full pipeline. Zero overlap. Never touch `.codex/`.

## When to Use

**Explicit only** — never auto-activate.

```
mk:bootstrap [requirements]
mk:bootstrap [requirements] --full
mk:bootstrap [requirements] --fast
mk:bootstrap [requirements] --parallel
```

Do NOT invoke when: project already has source code, or you only need kit setup (use CLI).

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

Each workflow file defines the exact steps for that mode. After plan + scaffold, all modes load `references/shared-phases.md` for implementation → docs → final report.

## Planning BEFORE Scaffolding

**Plan first, scaffold second.** The plan tells us WHAT to scaffold.

1. **Plan** — invoke mk:plan-creator with mode-matched flag. Plan defines: architecture, modules, file structure, acceptance criteria.
2. **Scaffold** — generate files following the plan's architecture + `references/scaffolding-principles.md`. Detect stack via `scripts/detect-stack.sh`. Validate with `scripts/validate-bootstrap.sh`.

Optional: invoke `mk:plan-ceo-review` on the plan (Full mode).

**Planning is NOT optional.** Every bootstrap creates a plan before generating any source files.

## Gotchas (top 3)

- **Scaffolding before planning**: generating files without a plan → plan first, scaffold second
- **Skipping research on "simple" projects**: hidden complexity → always research unless `--fast`
- **Duplicating CLI init**: never generate .codex/ files — CLI handles that

Full list: `references/gotchas.md`

## Workflow Integration

Pre-workflow. Bootstrap IS the full workflow for new projects:
```
mk:bootstrap → [research → design → plan → scaffold → cook → docs] → done
```

For subsequent features on the same project: use `mk:plan-creator` → `mk:cook` directly.