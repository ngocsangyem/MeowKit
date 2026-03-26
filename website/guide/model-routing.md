---
title: Model Routing
description: How MeowKit assigns the right AI model tier to each task.
persona: B
---

# Model Routing

MeowKit declares complexity before every task, ensuring trivial tasks don't burn expensive models and complex tasks get the reasoning power they need.

## Routing table

| Task type | Model tier | Examples |
|-----------|-----------|---------|
| **Trivial** | Cheapest (Haiku) | Rename, typo, format, version bump, config change |
| **Standard** | Default (Sonnet) | Feature (<5 files), bug fix, test writing, API endpoint |
| **Complex** | Best (Opus) | Architecture, security audit, multi-module refactor, auth/payments |

## How it works

The orchestrator agent classifies every incoming task and prints:

```
Task complexity: STANDARD → using Sonnet
```

### Escalation rules

- **Always Complex:** Authentication, payment processing, database schema, security audit
- **Never downgrade:** Once assigned, a task stays at its tier for the entire session
- **Code review always Complex:** Structural audits need the highest reasoning capability

## Agent default models

| Agent | Default | Upgrades to Opus when |
|-------|---------|----------------------|
| orchestrator | Haiku | Never (routing only) |
| planner | Sonnet | Complex multi-phase planning |
| architect | Sonnet | Schema design, migrations |
| developer | Sonnet | Never |
| reviewer | Sonnet | Security-critical reviews |
| security | Sonnet | Full audits |
| analyst | Haiku | Never |
