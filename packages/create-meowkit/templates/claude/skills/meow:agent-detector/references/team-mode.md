# Team Mode Detection

**When:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is enabled.

Team mode spawns multiple Claude Code instances as **teammates** (persistent, peer-to-peer messaging, shared task list) instead of **subagents** (fire-and-forget, hub-spoke).

## Complexity Gate (CRITICAL -- Token Savings)

**Team mode is ONLY for Deep complexity + multi-domain tasks.** All other tasks use single-agent or subagent mode to save tokens.

```toon
team_decision[5]{condition,mode,reason}:
  Complexity=Quick,single agent,Trivial task - no team overhead
  Complexity=Standard,subagent,Standard tasks never need teams - save tokens
  Complexity=Deep + 1 domain,subagent,Deep but single-focus - one agent sufficient
  Complexity=Deep + 2+ domains (>=50 each),team (if enabled),Only case for parallel teammates
  Agent Teams disabled,subagent,Feature not enabled - always subagent
```

**Token impact:** Team mode costs ~3x tokens (3 parallel context windows). Only justified when task requires parallel cross-domain work that would take 3x longer sequentially.

**Gate checks (ALL must pass):**
1. `isAgentTeamsEnabled()` returns true
2. Complexity = Deep
3. 2+ domains score >=50 each
4. Task requires cross-domain collaboration (not just multiple files)

## Team Mode Output Format

When team mode is selected, output:

```markdown
## Detection Result
- **Agent:** architect (LEAD)
- **Mode:** team
- **Model:** opus
- **Complexity:** Deep
- **Team Composition:**
  - architect (lead) - system design, API endpoints
  - frontend (primary) - frontend components
  - tester (primary) - test strategy + TDD
- **Reason:** Multi-domain feature requiring parallel work
```

When team mode is NOT selected (most tasks), output:

```markdown
## Detection Result
- **Agent:** architect
- **Mode:** subagent
- **Model:** sonnet
- **Complexity:** Standard
- **Reason:** Single-domain task, team not needed
```

## After Detection -- Handoff

```toon
handoff[3]{mode,action,target}:
  single agent,Execute directly in current session,N/A
  subagent,Use Task tool with subagent_type,Task(subagent_type="architect")
  team,Hand off to workflow-orchestrator for parallel startup,workflow-orchestrator -> TeamCreate -> parallel Task calls
```

**Team handoff:** Agent detector does NOT create the team. It returns the detection result with `Mode: team` and `Team Composition`. The **workflow-orchestrator** handles the actual parallel startup sequence (TeamCreate -> TaskCreate -> parallel Task spawns).

## Team Composition Rules

```toon
team_rules[4]{rule,detail}:
  Max teammates per phase,3 (lead + 2 primary)
  Lead selection,Highest scoring agent from detection
  Primary selection,Score 50-79 agents become teammates
  Minimum for team mode,2+ domains with score >=50 each
```
