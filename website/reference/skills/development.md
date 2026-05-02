---
title: "mk:development"
description: "Implementation toolkit — code patterns, TDD enforcement (opt-in via --tdd), skill lazy-loading. Used by the developer agent."
---

# mk:development

Reference guides for implementation: code patterns, TDD enforcement (opt-in), and skill loading. Used by the `developer` agent in Phase 2-3.

## When to use

- Phase 3 (Build) for implementation guidance
- `developer` agent needs coding pattern references
- TDD enforcement rules during red/green/refactor cycle (TDD mode only)

## References (loaded on-demand)

| Reference | When | Content |
|---|---|---|
| `code-patterns.md` | During implementation | Architecture patterns, file organization, coding conventions |
| `tdd-enforcement.md` | Phase 2-3 (TDD mode only) | RED/GREEN/REFACTOR cycle, test-first rules, coverage requirements |
| `skill-loader.md` | Skill activation | How to load skills on-demand, lazy loading patterns |

## TDD enforcement

TDD enforcement is OPT-IN as of the TDD-optional migration. Default mode skips RED-phase enforcement. Enable with `--tdd` or `MEOWKIT_TDD=1`.

## Gotchas

- TDD enforcement blocks exploratory prototyping in strict mode → use default mode for prototypes; opt into `--tdd` for production work
- 200-line file rule exempts auto-generated files (migrations, schemas) by design
