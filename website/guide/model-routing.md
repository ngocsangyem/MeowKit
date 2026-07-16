---
title: Model Routing
description: How MeowKit assigns the right AI model tier to each task — Trivial, Standard, or Complex.
---

# Model Routing

The orchestrator classifies every task by complexity before work begins. `mk:scale-routing` emits provider-neutral complexity, workflow, and execution-tier signals; the active provider adapter maps those signals to its available models. The table below describes the Claude Code adapter.

## Routing table

| Complexity | Claude Code model | Examples |
|---|---|---|
| Trivial | Haiku | Rename, typo, format, version bump |
| Standard | Sonnet | Feature (<5 files), bug fix, test writing |
| Complex | Opus | Architecture, security audit, auth, payments |

## Escalation rules

- **Always Complex:** authentication, payment processing, database schema, security audit
- **Never downgrade:** once assigned, a task stays at its tier for the session
- **Code review always Complex:** structural audits need highest reasoning
- **Domain override:** `mk:scale-routing` checks a CSV of domain keywords (fintech, healthcare → high-assurance); the Claude Code adapter maps high-assurance to COMPLEX.

## Domain-based routing (Phase 0)

Before manual classification, `mk:scale-routing` reads keywords from the task and matches against `domain-complexity.csv`:

| Domain | Keywords | Execution tier / Claude Code mapping |
|--------|----------|--------|
| fintech | payment, stripe, billing, invoice | high-assurance → COMPLEX |
| healthcare | hipaa, phi, ehr, patient data | high-assurance → COMPLEX |
| auth | oauth, jwt, session, credentials | high-assurance → COMPLEX |
| docs | readme, changelog, comment | Allow one-shot |
| config | env, .yaml, version bump | Allow one-shot |

The CSV is user-editable. Add rows for your project's domains. Scale-routing verdicts cannot be downgraded mid-task; each provider adapter then applies its own model policy.

## Planning depth per mode

| Mode | Researchers | Approach |
|------|------------|----------|
| `strict`, `architect` | 2 (parallel) | Competing approaches, forced synthesis |
| `default`, `audit` | 1 | Standard depth |
| `fast`, `cost-saver`, `document` | 0 | Skip research |

## Adaptive density

For Claude Code harness builds, density auto-adjusts per model tier: Haiku → MINIMAL, Sonnet → FULL, Opus 4.6+ → LEAN. See [Adaptive Density](/guide/adaptive-density).

## See also

- [Adaptive Density](/guide/adaptive-density) — scaffolding by model capability
- [Orchestrator agent](/reference/agents/orchestrator) — the routing agent
