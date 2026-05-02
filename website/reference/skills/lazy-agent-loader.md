---
title: "mk:lazy-agent-loader"
description: "mk:lazy-agent-loader"
---

## What This Skill Does

`mk:lazy-agent-loader` manages agent context budget in multi-agent workflows by loading only agent summaries initially (~50 tokens each) and deferring full agent definitions until an agent is selected. This avoids loading all agent files at session start, which would consume ~26,000 tokens.

## When to Use

Automatically invoked by `mk:agent-detector` during agent selection. Not user-invocable directly. Activated after the detector scores all agents and identifies PRIMARY/SECONDARY/OPTIONAL tiers.

## Core Capabilities

### Agent Index (Summaries Only)

The skill maintains a compact index of all 15 agents:

| Agent | Category | Specialty | Signal Keywords |
|-------|----------|-----------|-----------------|
| orchestrator | infra | Task routing / complexity classification | route, classify, assign, complexity |
| planner | planning | Two-lens planning / Gate 1 | plan, feature, design, scope, requirements |
| architect | planning | ADRs / system design | architecture, schema, api, infra, design, migration |
| developer | dev | Implementation (TDD) | implement, build, code, feature, fix, refactor |
| tester | quality | TDD enforcement / test writing | test, testing, coverage, qa, jest, vitest, pytest |
| reviewer | quality | 5-dimension code review / Gate 2 | review, audit, quality, standards |
| security | quality | Security audit / BLOCK verdicts | security, vulnerability, audit, owasp, injection |
| shipper | ops | Deploy pipeline / PR creation | ship, deploy, release, commit, pr, ci |
| documenter | ops | Living docs / changelogs | docs, documentation, changelog, readme |
| analyst | infra | Cost tracking / pattern extraction / memory | cost, budget, patterns, metrics, usage, memory |
| researcher | planning | Technology research / library evaluation | research, compare, evaluate, library |
| brainstormer | planning | Solution brainstorming / trade-offs | brainstorm, alternatives, tradeoff, explore |
| journal-writer | ops | Failure documentation / lessons | failure, incident, postmortem, lesson |
| git-manager | ops | Git operations / commit / push / PR | git, commit, push, pull, branch, pr, merge |
| ui-ux-designer | dev | UI/UX design / frontend patterns | design, ui, ux, css, layout, accessibility, responsive |

### Token Savings

| Scenario | Without Lazy | With Lazy | Savings |
|----------|-------------|-----------|---------|
| Initial load (all agents) | ~26,000 | ~1,000 | 96% |
| Single agent task | ~26,000 | ~2,500 | 90% |
| Dual agent task | ~26,000 | ~4,000 | 85% |
| Full stack (3 agents) | ~26,000 | ~5,500 | 79% |

### Loading Tiers

| Score Tier | Load Behavior | Tokens |
|------------|--------------|--------|
| >= 80 (PRIMARY) | Full agent definition from `.claude/agents/[name].md` | ~500-2,000 |
| 50-79 (SECONDARY) | Summary only from index | ~50 |
| < 50 (OPTIONAL) | Not loaded | 0 |

### Agent Categories and When to Load

| Category | Agents | When to Load |
|----------|--------|-------------|
| planning | planner, architect, researcher, brainstormer | When plan/design/research requested |
| dev | developer, ui-ux-designer | When code/implementation requested |
| quality | tester, reviewer, security | When review/test/security requested |
| ops | shipper, documenter, journal-writer, git-manager | When ship/deploy/docs requested |
| infra | orchestrator, analyst | Auto-loaded by system at session start |

### Cache Strategy

Loaded agents are tracked in session state (`loaded_agents[]`). If an agent is already loaded, skip re-loading. Force reload with:

```
User: "reload agent developer"
```

The cache invalidates automatically when the agent file's mtime changes.

## Workflow

1. **Initial Load** — Load agent index (this file, ~1,000 tokens). Do NOT load individual agent files.
2. **Agent Detection** — `mk:agent-detector` scores all agents using index keywords.
3. **Primary Selection** — Agent(s) with score >= 80 identified as PRIMARY.
4. **Lazy Activation** — Load full definition for PRIMARY agent(s). Use summary for SECONDARY.
5. **Pre-load guard** — Agents needing session-start context (orchestrator, analyst) are pre-loaded even when lazy, to avoid missed context.

## Integration with Agent Detector

```
Step 1: Score agents using agent_index keywords
Step 2: Identify PRIMARY agent(s) with score >= 80
Step 3: Load ONLY PRIMARY agent full definitions
Step 4: For SECONDARY agents, use summary from index
```

## Example Prompt

```
User: "Fix the login bug"

1. Agent Detector scores all agents using index keywords:
   - developer: +60 (fix/bug) +20 (context) = 80 → PRIMARY
   - tester: +35 (bug implies test needed) → SECONDARY

2. Lazy Loader activates:
   - Load: .claude/agents/developer.md (~1,500 tokens)
   - Summary only: tester (score 50-79)

3. Total context: ~2,500 tokens (vs ~26,000 without lazy loading)
```

## Common Use Cases

- **Every multi-agent workflow** — automatically invoked by agent-detector
- **Large project with many agents** — reduces session-start token cost by 96%
- **Single-agent tasks** — only one full definition loaded, rest kept as summaries

## Pro Tips

- Agents that need session-start context (orchestrator, analyst) are pre-loaded even when lazy. Don't rely on lazy loading for these.
- If you update an agent definition file mid-session, use "reload agent [name]" to force cache invalidation. The cache auto-invalidates on file mtime change.
- The index file itself is ~1,000 tokens. This is the cost floor — no way to go lower without losing agent detection accuracy.