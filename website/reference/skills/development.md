---
title: "mk:development"
description: "Implementation toolkit — code patterns by stack, TDD enforcement (opt-in via --tdd), and on-demand skill loading. Used by the developer agent in Phase 2-3."
---

# mk:development — Development Toolkit

## What This Skill Does

Provides reference guides for implementing features: stack-specific code patterns with anti-patterns, opt-in TDD enforcement rules, and a skill lazy-loading system that loads only domain-relevant references.

TDD enforcement is **OPT-IN**. Default mode (TDD off) skips RED-phase enforcement — use this for prototypes and exploration. Opt into `--tdd` or `MEOWKIT_TDD=1` when shipping production-quality work.

## When to Use

- **Phase 3 (Build):** Implementation guidance and coding standards.
- When the `developer` agent needs stack-specific patterns.
- **Phase 2 (Test):** TDD enforcement rules (TDD mode only).

## Core Capabilities

### Stack-Specific Code Patterns (`references/code-patterns.md`)

**NestJS:**
- **Module/Controller/Service/DTO:** Every feature. Controllers handle HTTP, services handle logic. Anti-pattern: business logic in controllers.
- **Guard Usage:** `@UseGuards(AuthGuard, RolesGuard)` on every protected controller. Anti-pattern: relying on middleware alone.
- **Pipe Validation:** `@Body(ValidationPipe)` on every input endpoint. Anti-pattern: manual validation in services.
- **DTO with Validation:** `@IsString`, `@IsNotEmpty`, `@IsOptional` decorators on every DTO. Anti-pattern: raw `any` types.

**Vue 3:**
- **Composition API with Script Setup:** `<script setup lang="ts">` with `ref`, `computed`. Anti-pattern: Options API in new code, mixing APIs.
- **Pinia Store:** `defineStore` with composable-style setup. Anti-pattern: Vuex in new code, local-only state in Pinia.
- **Composables:** Reusable stateful logic via `useX()` functions. Anti-pattern: duplicating reactive logic, creating composables for non-reusable logic.

**Swift:**
- **MVVM:** `ObservableObject` ViewModel per screen. Anti-pattern: networking/business logic in Views.
- **Async-Await / Combine:** `async throws` for I/O. Anti-pattern: nested completion handlers, blocking main thread.
- **Protocol-Oriented Design:** Protocol for every service dependency. Anti-pattern: concrete class dependencies preventing testing.

**General Rules (all stacks):** No `any` types (`unknown` + narrow), explicit return types on public APIs, no magic strings (enums/constants), prefer immutability, one concern per file.

### On-Demand Skill Loading (`references/skill-loader.md`)

Only load skills relevant to the current domain. Never load all at once.

| Rule | Trigger | Loads |
|---|---|---|
| NestJS Backend | `.ts` with decorators, `modules/` dirs | code-patterns (NestJS), adversarial-review, red-green-refactor, general-documentation |
| Vue Frontend | `.vue` files, `vue`/`pinia` imports | code-patterns (Vue 3), visual-qa, red-green-refactor |
| Swift/iOS | `.swift`, `.xcodeproj` | code-patterns (Swift), red-green-refactor |
| Database | Migration files, `.sql`, Supabase | adr-generation |
| Planning | Design discussion, architecture | scope-challenge, adr-generation |
| Shipping | Deploy, PR, release, rollback | ship/SKILL.md |

**Always loaded:** session-capture (learnings), tdd-enforcement (test-first in TDD mode).

### TDD Enforcement (`references/tdd-enforcement.md` — TDD mode only)

- **Rule 1:** No implementation code until failing tests exist.
- **Rule 2:** Capture failing test output to prove it's running and failing for the right reason.
- **Rule 3:** Full test suite must pass after implementation — not just new tests.
- **Rule 4:** Max 3 fix attempts, then escalate to human with all outputs.
- **Rule 5:** Valid failing test = runs to completion, asserts expected behavior, fails because behavior is not yet implemented. NOT: syntax errors, import errors, skipped tests.

## Gotchas

- **TDD enforcement blocks exploratory prototyping** — strict red-green cycle slows rapid iteration. Default mode (TDD off) is the right choice for prototypes; opt into `--tdd` for production work.
- **200-line file rule on generated code** — auto-generated files (migrations, schemas) exceed limit by design. Exempt them explicitly in plan constraints.

## Example Prompts

- "Implement the user registration endpoint using NestJS patterns"
- "Create a Vue 3 checkout component following Composition API patterns"
- "Load the skills I need for this database migration task"
- "Enable TDD mode and implement the payment feature"

## Pro Tips

- Run `mk:clean-code` alongside `mk:development` — code patterns define structure, clean-code enforces quality.
- The skill-loader prevents context bloat. Let it decide what to load rather than specifying manually.
- For full-stack features (NestJS + Vue), the loader loads both domains — no need to request separately.