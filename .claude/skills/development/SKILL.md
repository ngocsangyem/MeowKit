---
name: mk:development
description: "Writes feature code to standards. NOT for mk:cook."
keywords:
  - development
  - feature-implementation
  - tdd-optional
  - coding-standards
  - skill-loading
when_to_use: "Coding outside a pipeline."
user-invocable: true
owner: utility
criticality: medium
status: active
runtime: claude-code
---

# Development

Write feature code in the supported stacks (NestJS, Swift) to the project's conventions, without running a plan-driven pipeline. Use it for coding outside a pipeline, or when the `developer` agent needs the stack patterns. For a plan-driven build with review and verification use `mk:cook`.

Done means the code compiles or type-checks, the project's existing tests pass, and nothing outside the task changed.

| Open | When |
| --- | --- |
| `references/code-patterns.md` | writing or reviewing NestJS or Swift code |
| `references/tdd-enforcement.md` | you want test-first work; it points to the opt-in rules in `mk:cook` |

TDD is opt-in (`--tdd` or `MEOWKIT_TDD=1`); without it, write tests the way the project already does.

## Gotchas

- **Strict TDD slows prototyping.** Leave TDD off for exploratory work and turn it on for production-quality changes.
- **The 200-line file guideline and generated code.** Migrations and schemas exceed it by design; exempt generated files explicitly in the plan constraints.
