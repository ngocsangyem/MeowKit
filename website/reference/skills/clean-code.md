---
title: "mk:clean-code"
description: "Pragmatic coding standards — SRP, DRY, KISS, YAGNI with concrete anti-patterns and a mandatory self-check."
---
# mk:clean-code
Pragmatic coding standards — SRP, DRY, KISS, YAGNI with concrete anti-patterns and a mandatory self-check.
## What This Skill Does
Enforces pragmatic coding standards across any language. Core principles: Single Responsibility, Don't Repeat Yourself, Keep It Simple, You Aren't Gonna Need It. Includes concrete anti-patterns (comment every line, helper for one-liner, factory for 2 objects) and a mandatory self-check before completing any task.
## Core Capabilities
- **Five principles** — SRP, DRY, KISS, YAGNI, Boy Scout Rule
- **Naming rules** — Variables reveal intent, functions verb+noun, booleans question form
- **Function rules** — Max 20 lines, one thing, few args, no side effects
- **Anti-patterns** — Specific patterns to avoid with concrete replacements
- **Self-check** — Mandatory verification before task completion
## Usage
Auto-activates on all code-writing tasks. No explicit invocation needed.
::: info Skill Details
**Phase:** 3  
**Used by:** developer agent
:::

## Gotchas

- **Over-abstracting simple code**: Creating helpers for one-time operations violates YAGNI → Three similar lines are better than a premature abstraction
- **Removing error handling deemed unnecessary**: Stripping try-catch from system boundaries loses resilience → Only remove error handling for internal calls with guaranteed contracts

## Related
- [`mk:lint-and-validate`](/reference/skills/lint-and-validate) — Automated linting after changes
- [`mk:typescript`](/reference/skills/typescript) — TypeScript-specific patterns
