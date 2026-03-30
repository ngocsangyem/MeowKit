---
title: Agents Index
description: "All 15 MeowKit agents with type, role, phase, and activation conditions."
---

# Agents Index

<span class="vp-badge info">v1.1.0</span>

Source file: `.claude/agents/AGENTS_INDEX.md`

## Agent Roster

| Agent | Type | Role | Phase | Auto-activate |
|-------|------|------|-------|---------------|
| [orchestrator](/reference/agents/orchestrator) | Core | Task router, complexity classification | 0 | Every task |
| [planner](/reference/agents/planner) | Core | Two-lens planning, Gate 1, bead decomposition | 1 | Standard/complex |
| [brainstormer](/reference/agents/brainstormer) | Support | Solution evaluation, trade-offs | 1 | Explicit or complex |
| [researcher](/reference/agents/researcher) | Support | Tech research, library evaluation | 0, 1, 4 | Explicit |
| [architect](/reference/agents/architect) | Core | ADRs, system design | 1 | Complex tasks |
| [tester](/reference/agents/tester) | Core | TDD red/green/refactor | 2 | After planning |
| [security](/reference/agents/security) | Core | Security audit, BLOCK verdicts | 2, 4 | Auth/payment changes |
| [developer](/reference/agents/developer) | Core | Implementation (TDD), bead processing | 3 | After tester |
| [ui-ux-designer](/reference/agents/ui-ux-designer) | Support | UI design, accessibility, responsive | 3 | Frontend detected |
| [reviewer](/reference/agents/reviewer) | Core | 5-dimension review, Gate 2 | 4 | After developer |
| [shipper](/reference/agents/shipper) | Core | Ship pipeline, PR creation | 5 | After Gate 2 |
| [git-manager](/reference/agents/git-manager) | Support | Stage, commit, push | 5, any | On "commit"/"push" |
| [documenter](/reference/agents/documenter) | Core | Docs sync, changelog | 6 | After ship |
| [analyst](/reference/agents/analyst) | Core | Cost tracking, patterns | 0, 6 | Session start/end |
| [journal-writer](/reference/agents/journal-writer) | Support | Failure documentation | 6 | On failure |

## Agent Types

- **Core** — Pipeline agents executing sequentially through phases 0-6. Each owns a distinct workflow phase.
- **Support** — Invoked on-demand by core agents or explicitly by user. Can be spawned as subagents.

### Support Agent Classification

| Agent | Subagent Type | Purpose |
|-------|--------------|---------|
| brainstormer | advisory | Provides analysis, no code changes |
| researcher | advisory | Provides research, no code changes |
| ui-ux-designer | advisory | Design decisions and implementation |
| git-manager | utility | Git operations on request |
| journal-writer | escalation | Activated on failure/escalation |

## Context Engineering

Every agent includes:

| Section | Purpose | Present in |
|---------|---------|-----------|
| Required Context | What to load before invoking (CW3) | All 15 agents |
| Failure Behavior | What to do when blocked (AI4) | 10 pipeline agents |
| Ambiguity Resolution | How to handle unclear inputs (AI7) | 5 high-priority agents |

## Subagent Status Protocol

<span class="vp-badge info">v1.1.0</span>

All subagents end responses with:

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** [1-2 sentences]
**Concerns/Blockers:** [if applicable]
```

See [output-format-rules.md Rule 5](/reference/rules-index#enforcement-mechanism-matrix) for handling rules.

## See Also

- [Skills Index](/reference/skills-index) — all 60+ skills
- [Rules Index](/reference/rules-index) — all 14 rules
- [Agent-Skill Architecture](/guide/agent-skill-architecture) — how agents and skills interact
