---
name: meow:party
description: >-
  Multi-agent collaboration session. Brings 2-4 agent perspectives into one discussion
  for architecture decisions, trade-off analysis, sprint retros, and brainstorming.
  Use when asked "should we X or Y?", "let's discuss", "design review", or "retro".
argument-hint: '"topic to discuss" [--agents planner,architect,developer]'
source: meowkit
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - AskUserQuestion
---

# Party Mode — Multi-Agent Collaboration

Bring multiple MeowKit agent perspectives into one room. Agents debate, challenge, and build on each other's ideas to catch design flaws before code exists.

## When to Use

- Architecture trade-offs ("REST vs GraphQL?", "monolith vs microservices?")
- Security vs UX trade-offs ("session timeout: 5min or 24hr?")
- Large refactors that touch many files (risk assessment)
- Sprint retrospectives (multi-perspective post-mortem)
- Brainstorming with domain expertise

## Protocol

### 1. Agent Selection

Based on topic keywords, select 2-4 agents:

| Topic Signals | Agents Selected |
|---------------|----------------|
| architecture, design, system, scale | architect + developer + planner |
| security, auth, token, session, encrypt | security + developer + planner |
| UI, UX, design, responsive, accessible | ui-ux-designer + developer + planner |
| test, coverage, TDD, quality | tester + developer + reviewer |
| performance, latency, optimize, cache | architect + developer + analyst |
| refactor, migration, breaking change | architect + developer + reviewer |
| sprint, retro, what went wrong | planner + developer + tester + reviewer |
| Default (no keyword match) | planner + architect + developer |

User can override with `--agents` flag.

### 2. Discussion Rounds

Each round, every selected agent responds to the topic in their role:

- **Round 1:** Each agent states their position (max 150 tokens each)
- **Round 2:** Each agent responds to others' positions — critique, build on, or counter (max 150 tokens each)
- **Round 3:** Each agent gives final recommendation (max 100 tokens each)

User can interject between rounds. User can say "decide" to skip to synthesis.

### 3. Synthesis

After rounds complete (max 3) or user says "decide":

```markdown
## Party Mode Decision Summary

### Topic: [topic]
### Agents: [list]

### Agreed Points
- [point all agents supported]

### Disagreements
- [point]: [Agent A position] vs [Agent B position]

### Risks Identified
- [risk flagged by any agent]

### Recommended Action
[synthesized recommendation based on majority + risk weight]

### Decision: [awaiting user input]
```

## Constraints (Anti-Token-Explosion)

- **Max 4 agents** per session
- **Max 3 rounds** before forced synthesis
- **Max 150 tokens** per agent response (rounds 1-2), 100 tokens (round 3)
- **Budget ceiling:** ~8K tokens per party session
- **No code changes** during party mode — discussion only

## Prompts

- `prompts/agent-selector.md` — Logic for choosing relevant agents
- `prompts/synthesis.md` — Template for decision summary

## Integration

Party mode is opt-in:
- User invokes `/meow:party "topic"`
- Orchestrator may suggest it for COMPLEX architectural decisions
- Never auto-triggered without user consent
- Does not replace or bypass any gates
