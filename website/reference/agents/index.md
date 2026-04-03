---
title: Agents Overview
description: MeowKit's 15 specialist agents and their roles in the development workflow.
persona: C
---

# Agents Overview

MeowKit includes 15 specialist agents. Each owns a specific concern — no two agents modify the same files.

:::info v2.0 agent count unchanged
v2.0 kept the same 15 agents. No new agents were added. ECC (Extreme Context Compression) patterns introduced in v2.0 were adapted as skill references rather than new agents — keeping the agent surface area stable.
:::

| Agent | Type | Role | Phase | Auto-activates |
|-------|------|------|-------|----------------|
| [orchestrator](/reference/agents/orchestrator) | Core | Task routing + complexity classification | 0 | Every task |
| [planner](/reference/agents/planner) | Core | Two-lens planning + Gate 1 | 1 | Standard/complex tasks |
| [brainstormer](/reference/agents/brainstormer) | Support | Solution evaluation + trade-offs | 1 | Explicit or complex |
| [researcher](/reference/agents/researcher) | Support | Tech research + library evaluation | 0,1,4 | Explicit |
| [architect](/reference/agents/architect) | Core | ADRs + system design | 1 | Complex tasks |
| [tester](/reference/agents/tester) | Core | TDD red/green/refactor | 2 | After planning |
| [security](/reference/agents/security) | Core | Security audit + BLOCK verdicts | 2,4 | Auth/payment changes |
| [developer](/reference/agents/developer) | Core | Implementation (TDD) | 3 | After tester |
| [ui-ux-designer](/reference/agents/ui-ux-designer) | Support | UI design, design systems, accessibility | 3 | Frontend tasks |
| [reviewer](/reference/agents/reviewer) | Core | 5-dimension review + Gate 2 | 4 | After developer |
| [shipper](/reference/agents/shipper) | Core | Ship pipeline + PR creation | 5 | After Gate 2 |
| [documenter](/reference/agents/documenter) | Core | Docs sync + changelog | 6 | After ship |
| [analyst](/reference/agents/analyst) | Core | Cost tracking + patterns | 0,6 | Session start/end |
| [journal-writer](/reference/agents/journal-writer) | Support | Failure documentation | 6 | On failure |
| [git-manager](/reference/agents/git-manager) | Support | Stage, commit, push (conventional commits) | 5, any | On "commit"/"push" |

## Agent Types

Agents fall into two categories based on how they activate and what role they play in the pipeline.

**Core** agents execute sequentially through the 7-phase pipeline. Each owns a distinct workflow phase and is routed automatically by the orchestrator. They form the backbone of every non-trivial task.

**Support** agents are invoked on-demand — either by a core agent that needs a specialist, or explicitly by the user. They can be spawned as subagents mid-phase without interrupting the pipeline sequence.

| Type | Activation | Examples |
|------|-----------|---------|
| **Core** | Sequential pipeline, routed by orchestrator | orchestrator, planner, developer, reviewer |
| **Support** | On-demand, spawnable as subagents | brainstormer, researcher, ui-ux-designer, git-manager |

## Subagent Status Protocol

Every agent that completes work as a subagent MUST end its response with a structured status block. This eliminates ambiguous "I'm done" handoffs and enables deterministic routing.

| Status | Meaning | Controller action |
|--------|---------|-----------------|
| **DONE** | Task completed successfully | Proceed to next step |
| **DONE_WITH_CONCERNS** | Completed but flagged doubts | Address correctness concerns before review; note tech debt and proceed |
| **BLOCKED** | Cannot complete task | Assess blocker — provide context, break task down, or escalate. Never retry same approach. |
| **NEEDS_CONTEXT** | Missing information to proceed | Provide missing context, then re-dispatch |

```
**Status:** DONE
**Summary:** Implemented JWT middleware, 12/12 tests passing.
**Concerns/Blockers:** [omit if none]
```

If a subagent fails 3+ times on the same task, escalate to the user — do not retry blindly.

## Context engineering

Every agent includes:
- **Required Context** — what to load before invoking
- **Failure Behavior** — what to do when blocked
- **Ambiguity Resolution** — how to handle unclear inputs (high-priority agents)
