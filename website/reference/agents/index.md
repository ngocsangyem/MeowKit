---
title: Agents Overview
description: MeowKit's 13 specialist agents and their roles in the development workflow.
persona: C
---

# Agents Overview

MeowKit includes 13 specialist agents. Each owns a specific concern — no two agents modify the same files.

| Agent | Role | Phase | Auto-activates |
|-------|------|-------|----------------|
| [orchestrator](/reference/agents/orchestrator) | Task routing + complexity classification | 0 | Every task |
| [planner](/reference/agents/planner) | Two-lens planning + Gate 1 | 1 | Standard/complex tasks |
| [brainstormer](/reference/agents/brainstormer) | Solution evaluation + trade-offs | 1 | Explicit or complex |
| [researcher](/reference/agents/researcher) | Tech research + library evaluation | 0,1,4 | Explicit |
| [architect](/reference/agents/architect) | ADRs + system design | 1 | Complex tasks |
| [tester](/reference/agents/tester) | TDD red/green/refactor | 2 | After planning |
| [security](/reference/agents/security) | Security audit + BLOCK verdicts | 2,4 | Auth/payment changes |
| [developer](/reference/agents/developer) | Implementation (TDD) | 3 | After tester |
| [reviewer](/reference/agents/reviewer) | 5-dimension review + Gate 2 | 4 | After developer |
| [shipper](/reference/agents/shipper) | Ship pipeline + PR creation | 5 | After Gate 2 |
| [documenter](/reference/agents/documenter) | Docs sync + changelog | 6 | After ship |
| [analyst](/reference/agents/analyst) | Cost tracking + patterns | 0,6 | Session start/end |
| [journal-writer](/reference/agents/journal-writer) | Failure documentation | 6 | On failure |

## Context engineering

Every agent includes:
- **Required Context** — what to load before invoking
- **Failure Behavior** — what to do when blocked
- **Ambiguity Resolution** — how to handle unclear inputs (high-priority agents)
