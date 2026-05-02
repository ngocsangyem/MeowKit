---
title: "mk:plan-creator"
description: "Scope-aware planning — creates structured plans with step-file workflow. 6 modes, bead decomposition, Gate 1 enforcement."
---

# mk:plan-creator

Creates structured plans from task descriptions. Auto-detects scope and selects the right planning mode. For simple tasks, produces a single plan.md. For complex tasks, produces plan.md + per-phase detail files with research, red-teaming, and validation. Enforces Gate 1.

## Usage

```bash
/mk:plan "add user authentication with JWT"
/mk:plan "refactor payment module" --hard
/mk:plan "build a kanban app" --product-level
/mk:plan "implement checkout" --parallel
/mk:plan "migrate to GraphQL" --two
/mk:plan "feature" --tdd                        # Inject TDD sections
```

## Planning modes

| Flag | Research | Output |
|---|---|---|
| (default) | Auto-detect from scope | Follows mode |
| `--fast` | Skip | Single `plan.md` — Goal, Context, Scope, Constraints, Approach, ACs |
| `--hard` | 2 researchers | `plan.md` (≤80 lines) + `phase-XX-name.md` detail files (12-section template each) |
| `--deep` | 2-3 researchers | Hard mode + per-phase file inventory, dependency maps, per-phase scouting |
| `--parallel` | 2 researchers | Hard mode + file ownership matrix, parallel group hydration |
| `--two` | 2 researchers | 2 competing approach files + trade-off matrix; user selects before Gate 1 |
| `--product-level` | 2 researchers (broader) | `plan.md` only — Vision, Features with user stories, Design Language, Out-of-Scope. NO phase files. NO file paths. |

**Composable:** `--tdd` injects TDD sections (RED phase requirements, test-first ACs, coverage targets) into every phase file. Compatible with `--hard` and `--deep`.

## Standalone subcommands

| Command | Purpose |
|---|---|
| `/mk:plan red-team {path}` | 4-persona adversarial review against existing plan; outputs `red-team-findings.md` |
| `/mk:plan validate {path}` | Structural validation against 12-section template |
| `/mk:plan archive` | Moves completed plans to `tasks/plans/archive/` |

## 9-step workflow

```
00: Scope → 01: Research → 02: Codebase Analysis → 03: Draft
→ 04: Semantic Checks → 05: Red-Team → 06: Validation Interview
→ 07: Gate 1 Approval → 08: Hydrate
```

Fast mode runs steps 00→03→04→07→08 (skip research, codebase, red-team, validation).

## Product-level mode

For green-field app builds. Sets ambition and constraints — no implementation path.

**Forbidden:** file paths, class/interface names, function signatures, database schemas, step-by-step instructions, specific package versions.

**Required:** ambitious vision (3-5 sentences), ≥8 features with user stories, design language section, AI integration opportunities, explicit out-of-scope anti-features.

**Handoff:** after Gate 1, route to `mk:harness` (NOT directly to developer).

## Bead decomposition

For COMPLEX tasks (5+ files): atomic work units. Each bead: name (`bead-NN-description`), file scope (glob patterns), binary ACs, estimated size (~150 lines impl, ~50 lines test), dependency list. Use template at `tasks/templates/bead-template.md`. Skip for TRIVIAL/STANDARD tasks or <5 files.

## Output

Plan file at `tasks/plans/YYMMDD-name/plan.md` with goal, acceptance criteria, constraints, scope. Phase files include: Context Links, Overview, Key Insights, Requirements, Architecture (+ Design Checklist), Related Code Files, Implementation Steps, Todo List, Success Criteria, Risk Assessment, Security, Next Steps.
