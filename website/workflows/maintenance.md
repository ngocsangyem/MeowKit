---
title: Maintaining Old Projects
description: Navigate, understand, and fix issues in unfamiliar or legacy codebases.
persona: B
---

# Maintaining Old Projects

> Orient yourself in unfamiliar code, then fix issues with full understanding.

**Best for:** Legacy codebases, inherited projects, unfamiliar code  
**Time estimate:** 30-60 minutes  
**Skills used:** [meow:scout](/reference/skills/scout), [meow:investigate](/reference/skills/investigate), [meow:fix](/reference/skills/fix)  
**Agents involved:** orchestrator (orients), developer, tester, analyst (captures learnings)

## Overview

When you open a codebase you've never seen before, MeowKit's first move is **orientation** — understanding the structure before touching anything. The **scout** maps the architecture, the **investigator** traces problems to root causes, and the **analyst** captures what you learn for next time.

## Step-by-step guide

### Step 1: Orient — understand the codebase

```
/meow:scout project structure
```

The [meow:scout](/reference/skills/scout) skill spawns 2-6 parallel Explore agents:

```
Scout Report:
  Architecture: Express + TypeScript | Monolith | Jest tests
  Entry points: src/index.ts, src/app.ts
  Key directories:
    src/api/ — 12 route files (REST endpoints)
    src/services/ — 8 service modules
    src/models/ — Sequelize models (PostgreSQL)
    tests/ — 45 test files (62% coverage)
  Patterns: MVC, service layer, repository pattern
  Complexity: Medium (4,200 LOC across 58 files)
```

### Step 2: Investigate the reported issue

```
/meow:fix users report slow page loads on the dashboard
```

The [meow:investigate](/reference/skills/investigate) skill traces the problem:

```
Phase 1 — Symptoms: Dashboard loads in 8 seconds (should be <2s)
Phase 2 — Trace: dashboard.controller.ts → dashboard.service.ts → 3 separate DB queries
Phase 3 — Pattern match: N+1 query pattern — loading users, then loading orders per user
Root cause: "Dashboard service makes N+1 queries. Each user triggers a separate order lookup."
```

### Step 3: Fix with understanding

The **developer** applies the fix with MeowKit's constraints:
- **meow:freeze** locks edits to `src/services/dashboard.service.ts`
- Regression test written: `test('dashboard loads in under 2 seconds')`
- Fix: Replace N+1 with a single JOIN query
- All 45 existing tests still pass

### Step 4: Capture learnings

The **analyst** routes the finding to `.claude/memory/fixes.json` (bug-class fix pattern):

```
Project: legacy-dashboard
Pattern: Dashboard has N+1 query patterns — check any service making
         per-record DB calls. Repository pattern should use eager loading.
```

Next time `meow:fix` runs, it loads `fixes.md`/`fixes.json` at task start and surfaces this pattern.

### Step 5: Document what you found

The **journal-writer** captures the investigation for future maintainers:

```
docs/journal/260327-dashboard-n-plus-1-fix.md
  What happened: Dashboard N+1 query causing 8s load times
  Root cause: Per-user order lookup in loop
  Fix: Single JOIN query
  Prevention: Add query profiling to CI
```

## What makes maintenance different

| Concern | Normal workflow | Maintenance workflow |
|---------|----------------|---------------------|
| First step | Plan the feature | Scout the codebase |
| Context | You know the code | You don't — scout maps it |
| Memory | Fresh session | Read previous lessons first |
| Scope | Defined by plan | Defined by freeze (lock to affected module) |
| Output | Feature + tests | Fix + journal entry + lessons for next time |
