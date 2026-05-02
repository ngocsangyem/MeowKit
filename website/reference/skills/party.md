---
title: "mk:party"
description: "Multi-agent collaboration — 2-4 agent perspectives debate architecture decisions and trade-off analysis."
---

# mk:party

Brings 2-4 agent perspectives into one discussion. Agents debate, challenge, and build on each other's ideas to catch design flaws before code exists. For dedicated retrospectives, use `mk:retro` instead.

## When to use

- Architecture trade-offs ("REST vs GraphQL?", "monolith vs microservices?")
- Security vs UX trade-offs ("session timeout: 5min or 24hr?")
- Large refactors touching many files (risk assessment)
- Brainstorming with domain expertise

## Protocol

1. **Agent selection** — based on topic keywords, select 2-4 agents:
   - Architecture/design → architect + developer + planner
   - Security/auth → security + developer + planner
   - UI/UX → ui-ux-designer + developer + planner
   - Cross-domain → 4 agents for full coverage

2. **Discussion** — structured debate with AskUserQuestion facilitation:
   - Round 1: Each agent states position + rationale
   - Round 2: Agents challenge each other's positions
   - Round 3: Forced synthesis — resolutions for each trade-off

3. **Output** — decision document covering: chosen approach, rationale, alternatives considered with rejection reasons, open risks, migration path

## Hard constraints

- Discussion only — no code changes
- Do not chain party with any implementation skill — user decides next step
- Force 2-4 agents for diversity; single-agent party is invalid
- All agents equal weight during debate (no default to orchestrator)
