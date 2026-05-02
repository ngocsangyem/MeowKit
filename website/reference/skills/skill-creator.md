---
title: "mk:skill-creator"
description: "Create new skills with proper structure, compliance checks, and registration. Enforces mk: prefix and context engineering principles."
---

# mk:skill-creator

Create new skills with proper structure, compliance, and registration. Enforces `mk:` prefix, sub-agents.md structure, and context engineering principles.

## When to use

- "create a skill", "build a new skill", "make a skill for [X]"
- Converting external skill for adoption
- Scaffolding a skill from a workflow pattern

Explicit: `/mk:skill-creator [name] [description]`

## Script-first approach

Python scripts handle scaffolding and validation. Claude reviews and fills content.

```bash
# Scaffold new skill
.claude/skills/.venv/bin/python3 .claude/skills/skill-creator/scripts/init-skill.py mk:my-feature --path .claude/skills

# Validate skill
.claude/skills/.venv/bin/python3 .claude/skills/skill-creator/scripts/validate-skill.py .claude/skills/my-feature/SKILL.md
```

## Process

1. Scaffold via init script
2. Fill SKILL.md with name, description, triggers, allowed-tools
3. Validate via validate script
4. Register — no separate registration step; validation confirms readiness
