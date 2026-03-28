---
title: "meow:bootstrap"
description: "Application scaffold for any stack with progressive generation, auto-detection, and post-scaffold validation."
---

# meow:bootstrap

Application scaffold for any stack with progressive generation, auto-detection, and post-scaffold validation.

## What This Skill Does

`meow:bootstrap` scaffolds your application code (src/, tests/, docs/, CI/CD) for any tech stack. It complements `npm create meowkit@latest` — the CLI sets up MeowKit infrastructure (.claude/, hooks, skills), while bootstrap generates the application code with MeowKit naming conventions pre-applied.

The skill auto-detects your stack from existing files, applies universal scaffolding principles, and validates the output with a deterministic script. For unknown stacks, it asks you about conventions before generating.

## Core Capabilities

- **Stack auto-detection** — detects from package.json, go.mod, Cargo.toml, Package.swift
- **Any stack support** — universal principles, not hardcoded templates; asks for conventions on unknown stacks
- **Progressive generation** — structure → config → source → tests → docs (never all at once)
- **Post-scaffold validation** — `validate-bootstrap.sh` checks for missing files and placeholder leaks
- **Config persistence** — saves detected stack + conventions to config.json for future runs
- **CLI boundary** — never generates .claude/ files (CLI handles that)

## When to Use This

::: tip Use meow:bootstrap when...
- Starting a new project from scratch
- You need application scaffolding beyond MeowKit infrastructure
- You want stack conventions and naming rules pre-applied
:::

::: warning Don't use meow:bootstrap when...
- Project already has source code → use `meow:plan-creator` for new features
- You only need MeowKit setup → use `npm create meowkit@latest`
- You need to reorganize existing files → use `meow:project-organization`
:::

## Usage

```bash
# Auto-detect stack from existing files
/meow:bootstrap my-project

# Specify stack explicitly
/meow:bootstrap my-project --stack vue3-ts

# Bootstrap with specific features
/meow:bootstrap my-project --stack nestjs
```

::: info Skill Details
**Phase:** Pre-workflow (before Phase 0)
**Invocation:** Explicit only — never auto-activates
:::

## Gotchas

- **Duplicating CLI init**: never generates .claude/ — CLI handles that
- **Over-scaffolding**: matches scope to config.json, asks before generating 10+ files
- **Context overflow**: progressive generation prevents generating all files at once

## Related

- [`meow:project-organization`](/reference/skills/project-organization) — File naming and directory rules (used during generation)
- [`meow:plan-creator`](/reference/skills/plan-creator) — Plan first feature after bootstrap
- [`meow:cook`](/reference/skills/cook) — Implement features after planning
