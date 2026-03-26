---
title: Architecture Decisions
description: Evaluate architectural tradeoffs and document decisions with ADRs.
persona: B
---

# Architecture Decisions

> Evaluate tradeoffs with evidence and document decisions as Architecture Decision Records.

**Best for:** Schema changes, new services, API design, infrastructure decisions  
**Time estimate:** 30-60 minutes  
**Skills used:** [meow:office-hours](/reference/skills/office-hours) (brainstorming), [meow:plan-eng-review](/reference/skills/plan-eng-review)  
**Agents involved:** architect (ADR generation), brainstormer (approach evaluation), researcher (tech research)

## Overview

When a task involves database schema, API contracts, service boundaries, or infrastructure changes, the **orchestrator** inserts the **architect** agent. The architect evaluates tradeoffs using evidence (not opinion), generates ADRs, and enforces existing architectural patterns.

## Step-by-step guide

### Step 1: Brainstorm approaches (optional but recommended)

```
"Should we use GraphQL or REST for our API?"
```

The **brainstormer** agent evaluates 2-3+ approaches:

| Approach | Pros | Cons | Choose when |
|----------|------|------|-------------|
| REST | Simple, cacheable, well-understood | Over/under-fetching | CRUD-heavy, simple data |
| GraphQL | Flexible queries, typed schema | Complex, caching harder | Mobile clients, complex relationships |
| tRPC | End-to-end type safety, zero overhead | TypeScript-only | Full-stack TS, internal APIs |

### Step 2: Research if needed

The **researcher** agent (using Haiku for cost efficiency) fans out queries to official docs, GitHub repos, and community resources:

```
Researcher findings:
  GraphQL: Established, but Apollo overhead concerns (bundle +45KB)
  tRPC: Emerging, excellent DX for TypeScript teams
  Confidence: HIGH (well-documented ecosystem)
```

### Step 3: Create the ADR

The **architect** agent (using Opus for complex reasoning) produces an ADR:

```markdown
# 0005: Use tRPC for Internal API

Status: Accepted

## Context
We need a typed API layer for our TypeScript monorepo.

## Decision
Use tRPC for internal services. REST for external/public APIs.

## Consequences
- [+] End-to-end type safety without code generation
- [+] Zero runtime overhead (compile-time only)
- [-] Locks us into TypeScript for all API consumers
- [~] External APIs still use REST (no migration needed)
```

Saved to `docs/architecture/0005-use-trpc-for-internal-api.md`.

### Step 4: Engineering review

```
/meow:plan-eng-review
```

The [meow:plan-eng-review](/reference/skills/plan-eng-review) skill validates: data flow correctness, edge cases, test strategy, and performance implications of the architectural decision.

## How the architect enforces patterns

The **architect** reads existing ADRs before reviewing new code. If implementation introduces patterns that conflict with accepted ADRs, it flags the violation and requires either: updating the implementation to match, or creating a new ADR that supersedes the old one.

## Next workflow

→ [Frontend Development](/workflows/frontend) — build frontend with Vue/TS patterns
