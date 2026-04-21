---
name: meow:lazy-agent-loader
description: "Use when managing agent context budget. Loads agent definitions on-demand instead of all-at-once, reducing token consumption in multi-agent workflows."
triggers:
  - "when agent is selected"
  - "agent:load"
allowed-tools: Read, Glob
source: aura-frog
---

# Lazy Agent Loader

**Priority:** HIGH - Load agents on-demand

---

## Purpose

Reduce token usage by:

1. Loading only agent **summaries** initially (~50 tokens each)
2. Loading **full definition** only when agent is activated
3. Caching loaded agents in session state

---

## Agent Index (Summaries Only)

```toon
agent_index[15]{id,category,specialty,keywords}:
  orchestrator,infra,Task routing/complexity classification,route/classify/assign/complexity
  planner,planning,Two-lens planning/Gate 1,plan/feature/design/scope/requirements
  architect,planning,ADRs/system design,architecture/schema/api/infra/design/migration
  developer,dev,Implementation (TDD),implement/build/code/feature/fix/refactor
  tester,quality,TDD enforcement/test writing,test/testing/coverage/qa/jest/vitest/pytest
  reviewer,quality,5-dimension code review/Gate 2,review/audit/quality/standards
  security,quality,Security audit/BLOCK verdicts,security/vulnerability/audit/owasp/injection
  shipper,ops,Deploy pipeline/PR creation,ship/deploy/release/commit/pr/ci
  documenter,ops,Living docs/changelogs,docs/documentation/changelog/readme
  analyst,infra,Cost tracking/pattern extraction/memory,cost/budget/patterns/metrics/usage/memory
  researcher,planning,Technology research/library evaluation,research/compare/evaluate/library
  brainstormer,planning,Solution brainstorming/trade-offs,brainstorm/alternatives/tradeoff/explore
  journal-writer,ops,Failure documentation/lessons,failure/incident/postmortem/lesson
  git-manager,ops,Git operations/commit/push/PR,git/commit/push/pull/branch/pr/merge
  ui-ux-designer,dev,UI/UX design/frontend patterns,design/ui/ux/css/layout/accessibility/responsive
```

---

## Loading Strategy

### Initial Load (~1200 tokens)

```
1. Load this index file (agent_index)
2. DO NOT load individual agent files
3. Use index for agent detection scoring
```

### On Agent Selection (~500-2000 tokens per agent)

```
1. Agent scores >=80 (PRIMARY) → Load full definition
2. Agent scores 50-79 (SECONDARY) → Load summary only
3. Agent scores <50 (OPTIONAL) → Don't load
```

### Full Definition Location

```
.claude/agents/[agent-name].md
```

---

## Integration with Agent Detector

```
Step 1: Score agents using agent_index keywords
Step 2: Identify PRIMARY agent(s) with score >=80
Step 3: Load ONLY PRIMARY agent full definitions
Step 4: For SECONDARY agents, use summary from index
```

## References

| Reference                                                 | When to load                 | Content                                           |
| --------------------------------------------------------- | ---------------------------- | ------------------------------------------------- |
| **[loading-details.md](./references/loading-details.md)** | When loading specific agents | Commands, token savings, cache strategy, examples |

**Note:** This skill is automatically used by `agent-detector` for optimized loading.

## Gotchas

- **Agent loaded too late missing context**: Lazy loading skips context that was available at session start → Pre-load agents that need session-start context (orchestrator, analyst)
- **Cache serving stale agent definition**: Agent file updated but cached version used → Invalidate cache on file mtime change
