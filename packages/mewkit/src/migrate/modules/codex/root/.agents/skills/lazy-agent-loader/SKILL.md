---
name: "lazy-agent-loader"
description: "Deprecated compatibility shim. Agent routing reads the canonical inventory under .codex/agents/ directly; do not use this skill for agent selection."
---

# Lazy Agent Loader (Deprecated)

The former hand-maintained agent list was stale. Use `mk:agent-detector`, which reads
the canonical `.codex/agents/` inventory and its routing rules. This compatibility
shim has no index and must not be selected by new workflows.

## Gotchas

- **Stale hand-maintained indexes drift:** route through the canonical inventory instead.