# Challenge Framework

Stress-test a replication/adaptation decision before it becomes implementation work.
Ask these 7 questions. Score risk. Present the decision matrix. Get human approval.

## Contents

- [7 Challenge Questions](#7-challenge-questions)
  - [1. Necessity](#1-necessity)
  - [2. Stack Fit](#2-stack-fit)
  - [3. Data Model](#3-data-model)
  - [4. Dependency Cost](#4-dependency-cost)
  - [5. Effort vs Value](#5-effort-vs-value)
  - [6. Blast Radius](#6-blast-radius)
  - [7. Maintenance Burden](#7-maintenance-burden)
- [Risk Scoring](#risk-scoring)
- [Decision Matrix Template](#decision-matrix-template)
- [Architecture Fitness Table](#architecture-fitness-table)


## 7 Challenge Questions

For each question, provide: source answer, our project answer, risk if wrong.

### 1. Necessity

Do we need this feature/pattern, or just the idea behind it?
Can our project get 80% of the value with existing code or libraries?

| Red Flag | Green Flag |
|----------|------------|
| We already have something similar | Nothing like this exists locally |
| A library covers 80% of it | No library fits our constraints |
| "Nice to have" with no user demand | Users are asking for this |

### 2. Stack Fit

Does this feature's architecture match our tech stack?
What needs translation vs what ports directly?

| Red Flag | Green Flag |
|----------|------------|
| Different paradigm (SSR vs SPA, SQL vs NoSQL) | Same or similar stack |
| Source uses framework we don't have | Shares our core frameworks |
| Requires rewriting >60% of the logic | Most logic ports directly |

### 3. Data Model

Does the source's data model conflict with ours?
What tables, collections, types, or API contracts need to change?

| Red Flag | Green Flag |
|----------|------------|
| Incompatible schema (relational vs document) | Compatible schema shapes |
| Requires migrating existing data | Additive only (new tables/types) |
| Touches auth or payment tables | Isolated data scope |

### 4. Dependency Cost

What new libraries, services, or infrastructure does this require?
License conflicts? Version conflicts with existing deps?

| Red Flag | Green Flag |
|----------|------------|
| Requires new runtime or infra (Redis, K8s, etc.) | Uses only existing infra |
| License is restrictive (GPL in MIT project) | Permissive license (MIT, Apache) |
| Conflicts with existing dependency versions | No version conflicts |

### 5. Effort vs Value

How much work to replicate vs the value delivered?
Weekend project or multi-sprint effort?

| Red Flag | Green Flag |
|----------|------------|
| Multi-sprint effort for marginal value | High value, low effort |
| Simpler alternative exists and is 80% as good | No simpler alternative |
| Core team unavailable to maintain it | Team has bandwidth |

### 6. Blast Radius

If the replicated feature breaks, what else breaks?
Isolated or deeply coupled to core flows?

| Red Flag | Green Flag |
|----------|------------|
| Touches auth, payments, or core data pipeline | Failure is isolated |
| Breaks existing APIs or contracts | No existing APIs affected |
| Requires changes across >5 files | Self-contained in 1-3 files |

### 7. Maintenance Burden

Who owns this after it's built?
Does it require ongoing sync with the source?

| Red Flag | Green Flag |
|----------|------------|
| Must track upstream changes to stay current | One-time port, then independent |
| No one on team understands the domain | Team has domain expertise |
| Source is actively evolving (breaking changes) | Source is stable/mature |

## Risk Scoring

Count how many questions have RED FLAG answers:

| Critical Count | Risk Level | Action |
|----------------|------------|--------|
| 0-2 | Low | Proceed to Decision phase |
| 3-4 | Medium | Resolve critical assumptions first |
| 5+ | High | Switch to `--compare` or reject |

A question is "critical" when being wrong could cause: data loss, security holes,
breaking existing features, or >2 days of rework.

## Decision Matrix Template

```markdown
| # | Decision | Source Way | Our Way | Hybrid | Risk | Choice |
|---|----------|-----------|---------|--------|------|--------|
| 1 | Auth | OAuth2 + sessions | JWT + cookies | Keep JWT, add OAuth | med | hybrid |
| 2 | DB schema | 5 tables + joins | 2 tables | Add 2, skip 1 | low | adapt |
| 3 | UI | Tailwind + Radix | MUI | Keep MUI, port logic | low | ours |
```

For each row: explain WHY you chose that option. "Source way" is not automatically better.

## Architecture Fitness Table

Quick pass/fail check before the full 7 questions:

| Check | Red Flag | Green Flag |
|-------|----------|------------|
| Stack fit? | Different paradigm entirely | Same or similar patterns |
| Coupling? | Deeply woven into source infra | Mostly self-contained |
| New deps? | Needs new ORM, runtime, or service | Reuses our existing stack |
| Blast radius? | Touches auth/payments/core data | Failure is isolated |
| Maintenance? | Must track upstream forever | One-time port |