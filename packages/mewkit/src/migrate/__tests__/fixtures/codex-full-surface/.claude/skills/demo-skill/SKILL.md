---
name: demo-skill
description: Demonstration skill exercising reference categories
---

# Demo Skill

<!-- ref: fenced-runtime-command (mapped, target migrates with this skill) -->
Run the bundled script:

```bash
python3 .claude/skills/demo-skill/scripts/run.py --input data.json
```

<!-- ref: fenced-runtime-command (unmapped runtime) -->
Validate docs before shipping:

```bash
node .claude/scripts/validate-docs.cjs
```

<!-- ref: inline-mapped-asset + inline-code-span -->
Read `references/usage.md` and .claude/skills/demo-skill/references/usage.md.

<!-- ref: citation -->
> Ported from external-org/agent-kit — .claude/skills/demo-skill/SKILL.md
