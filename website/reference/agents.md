---
title: Agents Reference
description: Complete agent roster — 17 specialist agents with type, role, phase, and activation conditions.
---

# Agents Reference

MeowKit ships 17 specialist agents. Each owns a specific phase or concern. No two agents modify the same file type.

## Core Agents

Pipeline agents that execute sequentially through phases 0-6.

| Agent | Phase | Role | Auto-activates |
|-------|-------|------|---------------|
| [orchestrator](/reference/agents/orchestrator) | 0 | Task router, complexity classification, model tier assignment | Every task |
| [planner](/reference/agents/planner) | 1 | Scope-adaptive planning, Gate 1, bead decomposition | Standard/complex tasks |
| [architect](/reference/agents/architect) | 1 | ADRs, system design | Complex tasks |
| [tester](/reference/agents/tester) | 2 | Test writing (TDD red/green/refactor) | After planning |
| [security](/reference/agents/security) | 2, 4 | Security audit, BLOCK verdicts | Auth/payment changes |
| [developer](/reference/agents/developer) | 3 | Implementation, bead processing | After tester |
| [evaluator](/reference/agents/evaluator) | 3, 4 | Behavioral verification, rubric grading | Harness pipeline, `mk:evaluate` |
| [reviewer](/reference/agents/reviewer) | 4 | 5-dimension structural audit, Gate 2 | After developer |
| [shipper](/reference/agents/shipper) | 5 | Deploy pipeline, PR creation | After Gate 2 |
| [documenter](/reference/agents/documenter) | 6 | Living docs, changelogs | After ship |
| [analyst](/reference/agents/analyst) | 0, 6 | Cost tracking, pattern analysis | Session start/end |
| [project-manager](/reference/agents/project-manager) | on-demand | Cross-workflow delivery tracking, status reports | On request via `/mk:status` |

## Support Agents

Invoked on-demand by core agents or explicitly by the user.

| Agent | Phase | Role | Subagent type |
|-------|-------|------|--------------|
| [brainstormer](/reference/agents/brainstormer) | 1 | Trade-off analysis, solution exploration | advisory |
| [researcher](/reference/agents/researcher) | 0, 1, 4 | Technology research, library evaluation | advisory |
| [ui-ux-designer](/reference/agents/ui-ux-designer) | 3 | UI design, accessibility, design systems | advisory |
| [git-manager](/reference/agents/git-manager) | 5, any | Git operations, conventional commits | utility |
| [journal-writer](/reference/agents/journal-writer) | 6 | Failure documentation, root cause analysis | escalation |

## Agent communication

All subagents report structured status on completion:

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** [1-2 sentences]
**Concerns/Blockers:** [if applicable]
```

## File ownership

No two agents modify the same file type. Conflicts escalate to human.

| File type | Owned by |
|-----------|----------|
| `src/`, `lib/`, `app/` | developer |
| `tasks/plans/` | planner |
| `tasks/reviews/` | reviewer |
| `docs/` | documenter |
| `.claude/memory/` | analyst, documenter |

## See also

- [How agents and skills work together](/core-concepts/how-it-works)
- [Workflow phases](/core-concepts/workflow)
- [Skills reference](/reference/skills)
- [Agent definitions on disk](https://github.com/ngocsangyem/MeowKit/tree/main/.claude/agents) — canonical source
