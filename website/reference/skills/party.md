---
title: "mk:party"
description: "Multi-agent deliberation for architecture decisions and trade-off analysis — 2-4 agent perspectives with mandatory decision writing."
---

# mk:party

## What This Skill Does

Brings 2-4 specialized agents together for structured deliberation on architecture decisions, trade-offs, and design choices. Agents are explicitly prompted to challenge and counter each other (anti-sycophancy). Discussions are discussion-only — no code is written. Every session MUST produce a decision record in `.claude/memory/decisions.md`.

## When to Use

- Architecture trade-off decisions (monolith vs microservices, SQL vs NoSQL)
- Design approach selection with multiple valid options
- Risk assessment requiring diverse perspectives
- **Trigger keyword:** "decide" in the task description
- **NOT for:** implementation, code review, bug fixing, single-perspective answers

## Core Capabilities

- **Agent selection:** maps domain signals (database, security, frontend, API, performance, infra, auth, data-modeling) to relevant agent perspectives
- **Anti-sycophancy:** agents are explicitly prompted to critique, counter, and challenge — not agree
- **Structured rounds:** Round 1 (independent positions) → Round 2 (critique and build on others) → Round 3 (final recommendation)
- **Mandatory output:** decision written to `.claude/memory/decisions.md` in specified format
- **Token budget:** max 4 agents, max 3 rounds, ~8K token ceiling per session

## Arguments

| Flag | Effect |
|------|--------|
| (no flag) | Auto-select 2-3 agents based on domain signals in the question |
| `--agents arch,sec` | Override agent selection with specific agent types |

## Workflow

1. **Detect domain** — scan the question for keywords to determine which agent perspectives are relevant
2. **Select agents** — map domain signals to agent types (max 4)
3. **Round 1** — each agent states their position independently (max 150 tokens each)
4. **Round 2** — agents respond to others' positions — critique, build on, or counter (max 100 tokens each)
5. **Round 3** — each agent delivers a final recommendation
6. **Synthesize** — produce a decision summary with areas of agreement, disagreement, and the recommended path
7. **Write** — persist decision to `.claude/memory/decisions.md`

## Usage

```bash
/mk:party should we use PostgreSQL or MongoDB for the analytics pipeline?
/mk:party --agents arch,sec,db microservices vs monolith for the payment module
```

## Example Prompt

```
We're building a real-time notification system. Should we use WebSockets, Server-Sent Events, or a polling-based approach? Consider latency requirements (sub-second), scale (10K concurrent users), and client compatibility (mobile + web).
```

## Common Use Cases

- Database selection decisions
- Architecture pattern selection (monolith vs microservices vs modular monolith)
- Authentication strategy selection (JWT vs session vs OAuth)
- API design approach selection (REST vs GraphQL vs gRPC)
- Infrastructure decisions (serverless vs containers vs VMs)

## Pro Tips

- **Phrase the question as a forced choice.** "Should we do X or Y?" produces better deliberation than "How should we do this?"
- **Party is discussion-only.** Do not chain it with `/mk:cook` in the same command — the decision must be written and reviewed first.
- **Read the decision later.** `.claude/memory/decisions.md` persists across sessions so future tasks can reference past architecture choices.

> **Canonical source:** `.claude/skills/party/SKILL.md`
