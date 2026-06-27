# Ops Metrics Design

How to define operational metrics that actually measure what matters.

## Philosophy

- Measure outcomes, not activity. "Tickets closed" is activity. "P95 resolution time" is outcome.
- Targets from reality, not aspiration. Measure current state first, then set target above baseline.
- Fewer metrics, deeply monitored > many metrics, loosely watched. 3-5 metrics per system is ideal.
- Every metric needs a red flag threshold — a value that triggers investigation, not just alerts.

## Metric Definition Template

For each metric, define all 7 fields:

```
Primary metric:   [what you measure — single number]
Target:           [value the team commits to meeting]
Red flag:         [value that triggers immediate investigation]
Diagnostic:       [2-3 supporting metrics that explain why the primary moved]
Lag/Lead:         [lag = results already happened | lead = predicts future results]
Cadence:          [how often reviewed: real-time | daily | weekly | monthly]
Owner:            [who is accountable for this metric]
```

## Red Flag Design

Red flags should trigger investigation, not panic. Design them carefully:

- Set red flag at 2-3 sigma below normal operating range (not at zero or worst-ever)
- Alert in both directions: too high AND too low can both indicate problems
- Example: if p99 latency is normally 200ms, red flag at 500ms (not at 1000ms) gives recovery time
- Flapping alerts (red→green→red repeatedly) signal the threshold is wrong, not the system

## Domain Fallbacks

When you don't know where to start, use these proven starting sets:

**SRE Golden Signals (any service)**
- Latency (p50, p95, p99) — how long requests take
- Traffic — requests/second
- Errors — error rate as % of requests
- Saturation — how "full" the service is (CPU, memory, queue depth)

**SaaS Business Metrics**
- MRR growth rate — month-over-month
- Churn rate — target <5% annually for SMB SaaS
- CAC payback period — months to recover acquisition cost
- NPS — target >40 for strong product-market fit

**API / Developer Platform**
- p99 response time — target <500ms for synchronous calls
- Error rate — target <0.1% for production APIs
- SDK adoption — % of users on latest major version
- Time-to-first-call — minutes from signup to first successful API call

**Supply Chain / Operations**
- WMAPE (weighted mean absolute percentage error) — forecast accuracy, target <25%
- Fill rate — % of orders fulfilled complete and on time
- Inventory turns — how often inventory cycles per year
- Stockout rate — target <2% for in-stock SKUs

## Brief Examples

| Domain | Metric | Target | Red Flag |
|---|---|---|---|
| SaaS | Monthly churn | <0.5%/mo | >1%/mo |
| API | p99 latency | <500ms | >2000ms |
| E-commerce | Cart abandonment | <70% | >85% |
| Support | First response time | <4h | >24h |
| Supply chain | WMAPE | <25% | >40% |
| Mobile app | Crash-free sessions | >99.5% | <99% |

## Cadence Rules

- Real-time: anything customer-facing (latency, errors, availability)
- Daily: conversion metrics, support queue depth, revenue
- Weekly: retention cohorts, feature adoption, NPS responses
- Monthly: strategic metrics (CAC, LTV, churn), roadmap progress
