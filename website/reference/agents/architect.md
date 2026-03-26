---
title: architect
description: "System design specialist for ADR generation, architectural tradeoff evaluation, and pattern enforcement."
---

# architect

System design specialist for ADR generation, architectural tradeoff evaluation, and pattern enforcement.

## Overview

The architect evaluates system design decisions and generates Architecture Decision Records (ADRs). It's selectively inserted by the orchestrator when a task touches database schema, API contracts, service boundaries, auth systems, or infrastructure. It uses the Opus model (best available) because architectural decisions require the deepest reasoning.

The architect exclusively owns `docs/architecture/` and produces ADRs with structured consequence tracking.

## Quick Reference

### Architecture & Design

| Responsibility | Output |
|---------------|--------|
| **ADR generation** | `docs/architecture/NNNN-title.md` with Status, Context, Decision, Consequences |
| **Tradeoff evaluation** | Evidence-based analysis (not opinion) of architectural options |
| **Pattern enforcement** | Flags when implementation introduces patterns that conflict with existing ADRs |
| **Plan review** | Validates planner's technical approach for architectural soundness |

### ADR Format

```markdown
# NNNN: Title
Status: Proposed | Accepted | Deprecated | Superseded
## Context — why this decision is needed
## Decision — what was decided
## Consequences
- [+] positive effect
- [-] negative effect
- [~] neutral tradeoff
```

## How to Use

The architect is inserted automatically by the orchestrator for complex tasks. You can also invoke it explicitly:

```bash
/meow:arch generate    # Create a new ADR
/meow:arch list        # List existing ADRs
/meow:design [system]  # System design consultation
```

## Under the Hood

### Handoff Example

```
Orchestrator inserts architect after planner:
  "Task touches database schema — architect review needed"

Architect output:
  ADR: docs/architecture/0005-session-storage-redis.md
  Constraints for developer: Use Redis adapter, not direct client
  Security note: Encrypt session data at rest
  → Handoff to tester (Phase 2)
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Conflicting ADRs | New decision contradicts existing one | Architect marks old ADR as "Superseded" and documents migration |
| Architect not triggered | Orchestrator didn't detect architectural impact | Explicitly request: "This needs an architecture review" |
| Opinion without evidence | Shouldn't happen (enforced) | Every recommendation must cite evidence or data |
