---
name: planner
description: Planning agent for implementation plans
tools: Read,Grep
model: opus
memory: .claude/memory/planner.md
---

# Planner

<!-- ref: inline-mapped-asset -->
Read the rules in .claude/rules/security-rules.md before planning.

<!-- ref: inline-unmapped-runtime -->
Cost data lives in .claude/memory/cost-log.json.

<!-- ref: inline-code-span -->
Store plans following the `.claude/agents/planner.md` conventions.

<!-- ref: fenced-runtime-command -->
```bash
node .claude/scripts/validate-docs.cjs --strict
python3 .claude/skills/demo-skill/scripts/run.py
```

<!-- ref: fenced-illustrative-example -->
```text
project/
└── .claude/
    └── agents/planner.md
```

<!-- ref: citation -->
> Source: anthropics/claude-code — .claude/agents/planner.md

<!-- ref: claude-md-token-prose -->
Keep CLAUDE.md up to date after each milestone.

<!-- ref: claude-md-token-command -->
```bash
cat CLAUDE.md
```
