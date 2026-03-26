<!-- Extracted from SKILL.md for progressive disclosure (checklist #11, #14) -->

# Agent Loading Details

## Loading Commands

### Load Single Agent
```bash
# Load full agent definition
cat agents/mobile.md
```

### Load Agent Summary
```toon
agent_summary{id,role,focus}:
  mobile,Senior React Native Developer,Expo/RN mobile apps with TypeScript
```

## Token Savings

```toon
comparison[4]{scenario,without_lazy,with_lazy,savings}:
  Initial load (24 agents),~48000,~1200,97.5%
  Single agent task,~48000,~2700,94.4%
  Dual agent task,~48000,~4200,91.3%
  Full stack (3 agents),~48000,~5700,88.1%
```

## Cache Strategy

### Session Cache
```
Loaded agents are cached in conversation context.
If agent already loaded, skip re-loading.
Track loaded agents: loaded_agents[]: mobile,tester
```

### Force Reload
```
User: "reload agent mobile"
→ Clear cache for agent
→ Re-read full definition
```

## Example Flow

```
User: "Create a React Native screen for login"

1. Agent Detector scores all agents using keywords from agent_index
   - mobile: +60 (react-native) +20 (context) = 80 PRIMARY
   - frontend: +35 (screen/login implies UI) → OPTIONAL

2. Lazy Loader activates:
   - Load: agents/mobile.md (~1500 tokens)
   - Skip: frontend (score < 50)

3. Context loaded:
   - Agent index: ~1200 tokens
   - mobile full: ~1500 tokens
   - Total: ~2700 tokens (vs ~48000 without lazy loading)
```

## Agent Categories

```toon
categories[4]{name,count,when_to_load}:
  dev,11,When code/implementation requested
  quality,3,When review/test/design requested
  ops,5,When deploy/integrate/notify requested
  infra,5,Usually auto-loaded by system
```
