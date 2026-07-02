# Project Instructions

<!-- ref: inline-mapped-asset -->
Follow the development rules in .claude/rules/security-rules.md.
Agents live in .claude/agents/ and skills in .claude/skills/.

<!-- ref: inline-unmapped-runtime -->
Never edit .claude/memory/ files by hand.

<!-- ref: fenced-runtime-command -->
```bash
node .claude/scripts/validate-docs.cjs
node .claude/hooks/validate-docs.cjs --check
```

<!-- ref: claude-md-token-prose -->
This CLAUDE.md file is the entry point for project guidance.

<!-- ref: citation -->
> Source: anthropics/claude-code — docs/memory: CLAUDE.md loading order research
