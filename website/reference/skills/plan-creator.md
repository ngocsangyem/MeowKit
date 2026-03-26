---
title: "meow:plan-creator"
description: "Auto-selects the right plan template (quick vs standard vs phase) based on task scope and guides plan creation."
---
# meow:plan-creator
Auto-selects the right plan template based on task scope and guides plan creation.
## What This Skill Does
When `/meow:plan` or `/meow:cook` is invoked, this skill determines which plan template to use: `plan-quick.md` for small tasks (<5 files, <2 hours), `plan-template.md` for standard features, or `plan-phase.md` for individual phases of multi-phase work.
## Core Capabilities
- **Template selection** — Auto-routes to the right template by task scope
- **Three templates** — Quick (small), Standard (medium), Phase (large multi-part)
- **Gate 1 enforcement** — Plans must be approved before implementation
## Usage
```bash
/meow:plan add pagination    # → auto-selects quick template
/meow:plan build auth system # → auto-selects standard template
```
## Related
- [`meow:cook`](/reference/skills/cook) — Uses plan-creator as its first step
