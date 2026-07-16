---
name: mk:lazy-agent-loader
description: Deprecated compatibility shim. Agent routing reads the canonical inventory under .claude/agents/ directly; do not use this skill for agent selection.
triggers:
  - never
allowed-tools: Read, Glob
source: aura-frog
keywords:
  - lazy-agent-loader
  - deprecated
when_to_use: Do not invoke for new workflows. Use mk:agent-detector and the canonical .claude/agents/ inventory instead.
user-invocable: false
owner: research
criticality: medium
status: deprecated
runtime: claude-code
---

# Lazy Agent Loader (Deprecated)

The former hand-maintained agent list was stale. Use `mk:agent-detector`, which reads
the canonical `.claude/agents/` inventory and its routing rules. This compatibility
shim has no index and must not be selected by new workflows.

## Gotchas

- **Stale hand-maintained indexes drift:** route through the canonical inventory instead.
