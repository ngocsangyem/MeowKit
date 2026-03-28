---
name: meow:bootstrap
version: 1.0.0
description: |
  Use when creating a new project from scratch and needing application scaffold
  (src/, tests/, docs/, CI/CD) beyond what npm create meowkit@latest provides.
  Explicit invocation only — never auto-activates. Complements CLI init:
  CLI = MeowKit infrastructure (.claude/, hooks), bootstrap = application code.
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

Scaffold application code for any stack with progressive generation and validation.

**CLI boundary:** `npm create meowkit@latest` = MeowKit infrastructure. `meow:bootstrap` = application code. Zero overlap.

## When to Invoke

**Explicit only** — never auto-activate. Scaffolding is destructive.

```
meow:bootstrap [project-name]
meow:bootstrap [project-name] --stack vue3-ts
```

Do NOT invoke when: project already has source code structure, or you only need MeowKit setup (use CLI instead).

## Process

1. **Detect stack** — run `scripts/detect-stack.sh`. If detected, confirm with user. If not detected, ask: "What framework/language? Any conventions?"
2. **Read principles** — load `references/scaffolding-principles.md` for universal generation rules
3. **Gather config** — read config.json if exists, or ask via AskUserQuestion and save answers
4. **Generate structure** — create directory tree first. Print tree. Confirm with user before creating files.
5. **Generate files progressively** — config files → source scaffolds → test scaffolds → docs (README + code-standards). One module at a time — never all at once.
6. **Validate** — run `scripts/validate-bootstrap.sh`. On INCOMPLETE: fix issues, re-validate.
7. **Save profile** — write detected stack + conventions to config.json for future runs
8. **Handoff** — "Project ready. Run `meow:plan-creator` to plan first feature."

**Hard gate:** Do NOT generate .claude/ files — CLI handles that.

## Gotchas (top 3)

- **Duplicating CLI init**: generating .claude/ files that create-meowkit already provides → never touch .claude/
- **Over-scaffolding**: generating 20+ files for simple project → match scope to actual needs, ask first
- **Context overflow**: generating all files at once → progressive generation (structure → config → source → tests)

Full list: `references/gotchas.md`

## Workflow Integration

Pre-workflow (before Phase 0). After completion:

```
meow:bootstrap (scaffold) → meow:plan-creator (first feature) → meow:cook (implement)
```

## Handoff Protocol

On BOOTSTRAP_VALID:

- Print generated directory tree
- Save stack profile to config.json
- Next: "Project ready. Use `meow:plan-creator` to plan first feature."
