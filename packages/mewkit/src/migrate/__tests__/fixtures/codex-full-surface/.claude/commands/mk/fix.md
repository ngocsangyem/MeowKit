---
description: Fix a bug end to end
argument-hint: "[issue-id]"
allowed-tools: Bash(git *), Read
---

# Fix

<!-- ref: inline-mapped-asset -->
Fix the issue $ARGUMENTS following .claude/rules/security-rules.md.

Scope selector comes from `$1`.

<!-- ref: fenced-runtime-command -->
```bash
node .claude/scripts/scan.cjs $ARGUMENTS
```

<!-- ref: inline-mapped-asset (self) -->
See .claude/commands/mk/fix.md for the canonical source.
