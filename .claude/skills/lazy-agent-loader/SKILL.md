---
name: mk:lazy-agent-loader
description: Deprecated shim; agent routing reads .claude/agents/ directly. NOT for mk:agent-detector.
triggers:
  - never
allowed-tools: Read, Glob
source: aura-frog
keywords:
  - lazy-agent-loader
  - deprecated
when_to_use: Never invoke; kept only so older references still resolve.
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
