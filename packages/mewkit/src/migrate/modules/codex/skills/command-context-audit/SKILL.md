---
name: "command-context-audit"
description: "command-context-audit"
---

# the context-audit skill — Context Window Structural Audit

## Usage

```
the context-audit skill
the context-audit skill <scan-root>
```

## Behavior

Read-only audit of `.claude/` structural overhead. Reports prioritized
"remove X save Y tokens" recommendations against the model context window.

NOT for monetary cost tracking (see `the budget skill`).
NOT for transcript size.

### Execution

Invoke the `mk:context-audit` skill. The skill runs the pipeline:

```bash
bash .agents/skills/context-audit/scripts/inventory-context.sh "${1:-$PWD}" \
  | bash .agents/skills/context-audit/scripts/estimate-tokens.sh \
  | bash .agents/skills/context-audit/scripts/format-audit-report.sh
```

Output is markdown to terminal. No files are modified.

See the skill body at `.agents/skills/context-audit/SKILL.md` for full details
on output sections, thresholds, and how recommendations are prioritized.