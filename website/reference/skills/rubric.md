---
title: "mk:rubric"
description: "Rubric library API — load, list, compose, and validate graded evaluation rubrics with PASS/WARN/FAIL grading."
---

# mk:rubric

Discovery, composition, and validation API for the rubric library at `.claude/rubrics/`. Consumed by the `evaluator` agent and `mk:evaluate` skill. Independently invokable via `/mk:rubric <subcommand>` for manual inspection or composition outside the evaluator workflow.

## Subcommands

| Subcommand | Purpose | Output |
|---|---|---|
| `list` | List all rubrics + presets | Table: name, weight_default, applies_to |
| `load <name>` | Load single rubric as prompt-ready fragment | Markdown block for evaluator prompt injection |
| `compose <preset>` | Load preset and return all member rubrics + weights | Composed fragment with weight table |
| `validate [path]` | Validate rubric(s) against schema.md | PASS/FAIL with diagnostics |
| `validate --preset [path]` | Validate preset (weights sum to 1.0 ±0.01) | PASS/FAIL |

## Usage examples

```bash
# List all available rubrics
rubric/scripts/load-rubric.sh --list

# Compose frontend-app preset
rubric/scripts/load-rubric.sh --compose frontend-app

# Validate all rubrics
rubric/scripts/validate-rubric.sh
```

## Presets

| Preset | Loads | Use for |
|---|---|---|
| `frontend-app` | product-depth, functionality, design-quality, originality | SPAs, MPAs |
| `backend-api` | product-depth, functionality, code-quality | APIs, services |
| `cli-tool` | functionality, product-depth, code-quality, ux-usability | CLI tools |
| `fullstack-product` | All 7 rubrics (ux-usability weighted 3×) | End-to-end products |

## Path convention

All commands assume cwd is `$CLAUDE_PROJECT_DIR`. Prefix paths with `"$CLAUDE_PROJECT_DIR/"` when invoking from subdirectories.
