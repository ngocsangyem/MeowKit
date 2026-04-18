---
title: Starting a New Project
description: Set up MeowKit in a new or existing project and run your first task.
persona: A
---

# Starting a New Project

> Initialize MeowKit and scaffold your first plan.

**Best for:** First-time users  
**Time estimate:** 5 minutes  
**Skills used:** `npx mewkit init`, [meow:plan-creator](/reference/skills/plan-creator)

## Overview

This workflow gets you from an empty project to a fully configured MeowKit environment with your first approved plan. By the end, you'll understand how MeowKit's agents, gates, and workflow phases work together.

## Prerequisites

- Node.js 20+, Python 3.9+, Git installed
- Claude Code installed ([claude.ai/code](https://claude.ai/code))
- A project directory (new or existing)

## Step-by-step guide

### Step 1: Install MeowKit

```bash
npx mewkit init
```

The CLI auto-detects your tech stack and asks configuration questions (project name, stack, team size, mode, memory, optional Gemini API key). Takes ~30 seconds.

**What gets created:** A `.claude/` directory with 13 agents, 42 skills, lifecycle hooks, security rules, and a memory system. Plus `CLAUDE.md` (the entry point Claude reads at session start).

### Step 2: Verify installation

```bash
npx mewkit doctor
```

Checks: Node.js version, Python available, Git configured, hooks executable, scripts present.

### Step 3: Start Claude Code

```bash
claude
```

Claude reads `CLAUDE.md` automatically. The **orchestrator** agent activates and reads `memory/cost-log.json` for cost history. Topic files in `.claude/memory/` (`fixes.md`, `review-patterns.md`, `architecture-decisions.md`) are loaded on-demand by consumer skills at task start — they are empty on first run.

### Step 4: Plan your first feature

```
/meow:plan add user authentication with JWT
```

Here's what happens behind the scenes:

1. **Orchestrator** classifies the task as COMPLEX (auth-related → always complex) and assigns the Opus model tier
2. **Orchestrator** routes to the **planner** agent
3. **Planner** applies two lenses:
   - **Product lens:** "Is JWT the right choice? Have you considered session-based auth? What are your scale requirements?"
   - **Engineering lens:** "Where will tokens be stored? What's the refresh strategy? How will you handle token revocation?"
4. **Planner** produces a plan file at `tasks/plans/YYMMDD-auth.md` with: Problem Statement, Success Criteria, Out of Scope, Technical Approach, Risk Flags, Estimated Effort
5. **Gate 1** activates — you must type `approve` to continue

### Step 5: Approve and build

After reviewing the plan, approve it. Then run the full pipeline:

```
/meow:cook
```

This executes Phases 2-6 automatically:
- **Phase 2:** In TDD mode (`--tdd`), the **tester** agent writes failing tests for the auth module. In default mode, Phase 2 is skipped unless requested.
- **Phase 3:** The **developer** agent implements per the plan (self-heals up to 3 times). In TDD mode, until failing tests pass.
- **Phase 4:** The **reviewer** agent checks 5 dimensions (architecture, types, tests, security, performance). The **security** agent auto-inserts because this is auth-related.
- **Gate 2:** You approve the review verdict
- **Phase 5:** The **shipper** agent creates a conventional commit, pushes, and creates a PR
- **Phase 6:** The **documenter** updates docs, the **analyst** captures patterns

## What MeowKit does automatically

| Phase | Agent | Hook/Gate | What happens |
|-------|-------|-----------|-------------|
| 0 | orchestrator | — | Reads memory, classifies complexity, assigns model tier |
| 1 | planner | **Gate 1** | Creates plan, waits for human approval |
| 2 | tester | `pre-implement.sh` (skill-invoked, TDD-mode only) | TDD mode: writes failing tests, blocks implementation. Default mode: optional/on-request. |
| 3 | developer | `post-write.sh` | Implements code, security scan on every file write |
| 4 | reviewer + security | **Gate 2** | 5-dimension audit + security audit, waits for approval |
| 5 | shipper | `pre-ship.sh` | Test + lint + typecheck, then commit → PR |
| 6 | documenter + analyst | — | Update docs, capture patterns to memory |

## Next workflow

→ [Adding a Feature](/workflows/add-feature) — how to add features after initial setup
