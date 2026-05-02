---
title: "mk:skill-creator"
description: "Create new skills with proper structure, compliance checks, and registration. Enforces mk: prefix and context engineering principles."
---

# mk:skill-creator — Skill Scaffolding & Validation

## What This Skill Does

Create new skills with proper structure, compliance, and registration. Enforces the `mk:` prefix, sub-agents.md structure, and Anthropic context engineering principles.

## When to Use

- User asks to "create a skill", "build a new skill", "make a skill for [X]"
- Converting an external skill for adoption in MeowKit
- Scaffolding a skill from a workflow pattern
- Explicit: `/mk:skill-creator [`NAME`] [description]`

**Do NOT invoke:** When the user just wants to edit an existing skill's content — this is for creation and scaffolding only.

## Core Capabilities

- **Scaffolding:** `scripts/init-skill.py` creates directory + template SKILL.md with TODO markers
- **Validation:** `scripts/validate-skill.py` checks compliance against 8-point checklist
- **Content guidance:** References cover required sections, trigger-condition descriptions, gotcha writing, filesystem patterns, and 9-type taxonomy
- **Registration:** Adds attribution row to `SKILLS_ATTRIBUTION.md`

## Example Prompt

```
Create a new skill called mk:database that generates PostgreSQL schema migrations from TypeScript entity definitions. It should validate schemas against naming conventions and produce a migration plan.
```

## Process

1. **Gather intent** — what should the skill do? When should it trigger? What output format?
2. **Scaffold** — run `init-skill.py mk:NAME --path .claude/skills` to create directory + template
3. **Fill content** — Claude completes each TODO section in the generated template
4. **Add references/** — if skill body would exceed ~500 lines, split into reference files
5. **Security boundaries** — load `mk:skill-template-secure` for trust model if skill processes untrusted input
6. **Validate** — run `validate-skill.py` to check 8-point compliance
7. **Fix failures** — if score < 7/8, fix failing items
8. **Register** — add row to `SKILLS_ATTRIBUTION.md`
9. **Report** — output creation summary with compliance details

## Scripts
