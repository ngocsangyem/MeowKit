---
name: meow:development
description: "Use when implementing features, writing code, or needing TDD enforcement during Phase 3 (Build GREEN). Provides code patterns, skill loading, and coding standards."
---

# Development Toolkit

Reference guides for implementation: code patterns, TDD enforcement, and skill lazy-loading.

## When to Use

- During Phase 3 (Build GREEN) for implementation guidance
- When the `developer` agent needs coding pattern references
- For TDD enforcement rules during red/green/refactor cycle

## Workflow Integration

Operates in **Phase 2 (Test RED)** and **Phase 3 (Build GREEN)**. Output supports the `developer` and `tester` agents.

## References

| Reference | When to load | Content |
|-----------|-------------|---------|
| **[code-patterns.md](./references/code-patterns.md)** | During implementation | Coding patterns, architecture patterns, file organization |
| **[tdd-enforcement.md](./references/tdd-enforcement.md)** | Phase 2-3 | RED/GREEN/REFACTOR cycle, test-first rules, coverage requirements |
| **[skill-loader.md](./references/skill-loader.md)** | Skill activation | How to load skills on-demand, lazy loading patterns |

## Gotchas

- **TDD enforcement blocking exploratory prototyping**: Strict red-green cycle slows rapid iteration → Use fast mode for prototypes, switch to default mode before shipping
- **200-line file rule on generated code**: Auto-generated files (migrations, schemas) exceed limit by design → Exempt generated files explicitly in plan constraints
