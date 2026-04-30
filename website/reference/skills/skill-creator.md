---
title: "mk:skill-creator"
description: "Scaffold, validate, and register new MeowKit skills with script-driven compliance checking."
---

# mk:skill-creator

Scaffold, validate, and register new MeowKit skills with script-driven compliance checking.

## What This Skill Does

`mk:skill-creator` is MeowKit's tool for building new skills. It uses Python scripts for the deterministic parts (directory creation, template generation, compliance validation) and Claude for the creative parts (writing descriptions, designing processes). The result is a compliant skill directory with SKILL.md, references/, and a row in SKILLS_ATTRIBUTION.md.

## Core Capabilities

- **Script-driven scaffolding** — `init-skill.py` creates the directory + template SKILL.md with TODO markers for every required section
- **Name validation** — Enforces `mk:` prefix, kebab-case, max 40 chars, no consecutive hyphens
- **7-point compliance check** — `validate-skill.py` checks: SKILL.md exists, frontmatter present, mk: prefix, description filled, workflow phase, output template, progressive disclosure
- **Registration** — Adds skill to SKILLS_ATTRIBUTION.md

## When to Use This

::: tip Use mk:skill-creator when...
- You want to create a new skill for your project
- You're converting an external skill for MeowKit
- You need to scaffold from a workflow pattern
:::

## Usage

```bash
# Scaffold a new skill
/mk:skill-creator mk:my-feature "Description of what it does"

# Or use the scripts directly
python3 .claude/skills/skill-creator/scripts/init-skill.py mk:my-feature --path .claude/skills

# Validate after filling in content
python3 .claude/skills/skill-creator/scripts/validate-skill.py .claude/skills/my-feature
```

## Example Prompts

| Prompt | What happens |
|--------|-------------|
| `create a skill for database migrations` | Scaffolds mk:db-migrate with TODO markers → Claude fills each section |
| `create a skill for API documentation` | Scaffolds mk:api-docs → Claude writes process steps + output template |
| `validate my new skill` | Runs 7-point compliance check, reports score X/7 |

## Quick Workflow

```
Name + description → init-skill.py (scaffold)
  → Claude fills TODO sections
  → validate-skill.py (compliance check)
  → Score ≥ 6/7? → Register in SKILLS_ATTRIBUTION.md
  → Score < 6/7? → Fix failing items → re-validate
```

::: info Skill Details
**Phase:** any
:::

## Related

- [`mk:skill-template-secure`](/reference/skills/skill-template-secure) — Security template for skills handling untrusted input
- [Configuration](/reference/configuration) — Where skills are registered
