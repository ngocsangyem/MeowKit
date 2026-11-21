# Team Mode Detection

**When:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is enabled.

On Claude Code, team mode spawns multiple instances as **teammates** (persistent, peer-to-peer messaging, shared task list) instead of **subagents** (fire-and-forget, hub-spoke).

## Complexity Check (CRITICAL -- Token Savings)

**Team mode is ONLY for COMPLEX tasks + multi-domain tasks.** All other tasks use single-agent or subagent mode to save tokens.

```toon
team_decision[5]{condition,mode,reason}:
  Complexity=TRIVIAL,single agent,Trivial task - no team overhead
  Complexity=STANDARD,subagent,Standard tasks never need teams - save tokens
  Complexity=COMPLEX + 1 domain,subagent,COMPLEX but single-focus - one agent sufficient
  Complexity=COMPLEX + 2+ domains (>=50 each),team (if enabled),Only case for parallel teammates
  Agent Teams disabled,subagent,Feature not enabled - always subagent
```

**Token impact:** Team mode costs ~3x tokens (3 parallel context windows). Only justified when task requires parallel cross-domain work that would take 3x longer sequentially.

**Checks (ALL must pass):**
1. `isAgentTeamsEnabled()` returns true
2. Complexity = COMPLEX
3. 2+ domains score >=50 each
4. Task requires cross-domain collaboration (not just multiple files)

## Team Mode Output Format

When team mode is selected, output:

```markdown
## Detection Result
- **Agent:** architect (LEAD)
- **Mode:** team
- **Model:** opus
- **Complexity:** COMPLEX
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
  subagent,Hand off to the named agent,delegate a subagent (agent="architect")
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
