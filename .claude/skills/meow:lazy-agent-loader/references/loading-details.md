# Agent Loading Details

## Loading Commands

### Load Single Agent

```bash
# Load full agent definition from .claude/agents/
Read .claude/agents/developer.md
```

### Load Agent Summary

```toon
agent_summary{id,role,focus}:
  developer,Implementation specialist,TDD-enforced feature development
```

## Token Savings

```toon
comparison[4]{scenario,without_lazy,with_lazy,savings}:
  Initial load (13 agents),~26000,~1000,96%
  Single agent task,~26000,~2500,90%
  Dual agent task,~26000,~4000,85%
  Full stack (3 agents),~26000,~5500,79%
```

## Cache Strategy

### Session Cache

```
Loaded agents are cached in conversation context.
If agent already loaded, skip re-loading.
Track loaded agents: loaded_agents[]: developer,tester
```

### Force Reload

```
User: "reload agent developer"
→ Clear cache for agent
→ Re-read full definition from .claude/agents/developer.md
```

## Example Flow

```
User: "Fix the login bug"

1. Agent Detector scores all agents using keywords from agent_index
   - developer: +60 (fix/bug) +20 (context) = 80 PRIMARY
   - tester: +35 (bug implies test needed) → SECONDARY

2. Lazy Loader activates:
   - Load: .claude/agents/developer.md (~1500 tokens)
   - Summary only: tester (score 50-79)

3. Context loaded:
   - Agent index: ~1000 tokens
   - developer full: ~1500 tokens
   - Total: ~2500 tokens (vs ~26000 without lazy loading)
```

## Agent Categories

```toon
categories[4]{name,count,when_to_load}:
  planning,3,When plan/design/research requested
  dev,1,When code/implementation requested
  quality,3,When review/test/security requested
  ops,3,When ship/deploy/docs requested
  infra,3,Usually auto-loaded by system
```
