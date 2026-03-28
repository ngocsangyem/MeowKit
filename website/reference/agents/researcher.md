---
title: researcher
description: "Technology research agent that evaluates libraries, finds documentation, and gathers information with confidence levels."
---

# researcher

Technology research agent that evaluates libraries, finds documentation, and gathers information with confidence levels.

## Overview

The researcher is a read-only support agent that fans out queries to multiple sources: official docs, GitHub repos, community blog posts, Stack Overflow, and the existing codebase. It evaluates source quality, distinguishes between established/emerging/experimental technologies, and presents findings with confidence levels. It uses the Haiku model for cost efficiency since research tasks are high-volume.

## Quick Reference

### Creative & Research

| Capability | Details |
|-----------|---------|
| **Source evaluation** | Official docs (highest) → maintained repos → recent content (<12mo) → cross-referenced |
| **Technology classification** | Established (battle-tested) / Emerging (gaining traction) / Experimental (bleeding edge) |
| **Trade-off analysis** | What it solves, what it costs (complexity, bundle, learning curve, maintenance) |
| **Confidence levels** | Every finding includes confidence rating |
| **Cost-efficient** | Uses Haiku model for high-volume research work |

## How to Use

```bash
# Usually routed by orchestrator
"Research authentication libraries for Node.js"
"Compare Prisma vs Drizzle for our use case"
"Find docs on Vue 3 Suspense"

# Also invoked by meow:docs-finder for library documentation
```

## Documentation Chain

When researching a library or API, the researcher uses a **docs-finder-first** chain:

1. **meow:docs-finder** — resolves official docs via Context7 → Context Hub → WebSearch
2. **Codebase scan** — checks existing patterns with Grep/Glob before suggesting new approaches
3. **Cross-reference** — verifies findings against community sources for confidence rating

This ensures recommendations are grounded in current official docs, not stale training data.

## Report Saving

Research findings are saved to the active plan's reports directory:

```
tasks/plans/YYMMDD-name/reports/researcher-XX-report.md
```

If no active plan, reports fall back to `plans/reports/`.

## Under the Hood

### Handoff Example

```
Researcher findings:
  Topic: Authentication libraries for Node.js
  Confidence: HIGH (well-established ecosystem)

  Option 1: Passport.js
    Status: Established (10+ years, 200+ strategies)
    Trade-off: Flexible but verbose config
    Source: Official docs, npm trends, GitHub stars

  Option 2: Better Auth
    Status: Emerging (2024+, TypeScript-first)
    Trade-off: Modern DX but smaller community
    Source: GitHub, blog posts (cross-referenced)

  → Feeds into planner or brainstormer
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Outdated recommendations | Sources may be stale | Researcher marks content age; prefer <12mo sources |
| Low confidence findings | Limited or conflicting sources | Researcher flags explicitly — user makes final call |
| WebSearch unavailable | Tool restriction | Falls back to built-in knowledge with disclaimer |
