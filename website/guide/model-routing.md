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

## Scale-Adaptive Intelligence (Phase 0)

Before the orchestrator applies manual classification, MeowKit runs **domain-based routing** via the `meow:scale-routing` skill. It reads keywords from the task description and matches them against `domain-complexity.csv`.

```
Task: "Add Stripe payment checkout"
         │
         ▼
meow:scale-routing
  → domain: fintech
  → level: high
  → OVERRIDE → COMPLEX tier (no manual override possible)
```

### Domain routing table (examples)

| Domain | Keywords | Level | Effect |
|--------|----------|-------|--------|
| fintech | payment, stripe, billing, invoice | high | Force COMPLEX |
| healthcare | hipaa, phi, ehr, patient data | high | Force COMPLEX |
| auth | oauth, jwt, session, credentials | high | Force COMPLEX |
| docs | readme, changelog, comment | low | Allow one-shot |
| config | env, .yaml, version bump | low | Allow one-shot |

When level is `low` AND the task has zero blast radius, Gate 1 is bypassed (same behavior as `/meow:fix --quick`).

### Extending the CSV

The `domain-complexity.csv` file is user-editable. Add rows for your project's specific domains:

```csv
domain,keywords,level,workflow
payments,braintree;adyen;paypal,high,full
internal-tools,admin;dashboard;report,low,one-shot
```

### Anti-rationalization hardening

Scale-routing verdicts cannot be downgraded mid-task. If the CSV returns COMPLEX, the agent **cannot** argue its way to a cheaper tier. No exceptions.

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
