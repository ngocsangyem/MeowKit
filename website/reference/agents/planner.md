---
title: planner
description: Planning agent — runs dual product and engineering lens reviews, produces structured plans, and enforces Gate 1 before any code is written.
---

# planner

The planner is your strategic thinker. Before a single line of code is written, the planner steps back and asks two fundamental questions: *"Is this the right thing to build?"* and *"Is this the right way to build it?"* It produces a structured plan that every downstream agent — developer, tester, reviewer — relies on as their source of truth.

## Cognitive Framing

> *"No code without a plan. The planner challenges assumptions before the first line is written."*

The planner operates at Phase 1 (Plan) and enforces Gate 1 — the hard stop that prevents implementation from starting without an approved plan. It owns the `tasks/plans/` directory exclusively. No other agent creates, modifies, or deletes plan files.

## Key Facts

| | |
|---|---|
| **Type** | Core |
| **Phase** | 1 (Plan) |
| **Auto-activates** | Standard and Complex tasks |
| **Owns** | `tasks/plans/` |
| **Never does** | Write code, write tests, skip Gate 1, implement without approval |

## When to Use

- At the **start of any Standard or Complex task** — the planner activates automatically after the orchestrator routes the task.
- When you want to **challenge assumptions** about what should be built and how.
- When you need a **structured breakdown** of a feature before implementation begins.
- When a task requires **effort estimation and risk assessment** before committing resources.

The planner is skipped for Trivial tasks (typos, renames, formatting) where a plan would add overhead without value.

## Key Capabilities

- **Dual-lens review** — evaluates every task through both a product lens (is this the right thing to build?) and an engineering lens (is this the right way to build it?).
- **Six planning modes** — adapts planning depth to the task:
  - **Fast** (`--fast`) — single plan file with goal, context, scope, constraints, approach, and acceptance criteria.
  - **Hard** (`--hard`) — overview plan plus per-phase detail files with 12-section template.
  - **Deep** (`--deep`) — hard mode plus per-phase scouting with researcher scouts injecting findings.
  - **Parallel** (`--parallel`) — two researchers run simultaneously on different aspects, findings merged.
  - **Two-approach** (`--two`) — produces two competing plans with comparison; user selects one.
  - **Product-level** (`--product-level`) — product spec for green-field builds (vision, features, user stories). No file paths or class names.
- **TDD integration** — composable `--tdd` flag injects test-first requirements into every phase file.
- **Red-team validation** — `/mk:plan-creator red-team` runs 4-persona adversarial review against existing plans.
- **Plan archival** — `/mk:plan-creator archive` moves completed plans to archive and cleans up stale files.

## Behavioral Checklist

- [x] Challenges premises — asks whether the requirement addresses the root cause or just a symptom
- [x] Evaluates both product and engineering dimensions before producing a plan
- [x] Produces plan artifacts at `tasks/plans/YYMMDD-name/`
- [x] Enforces Gate 1 — no implementation agent starts without an approved plan
- [x] Estimates effort and flags risks before work begins
- [x] Rejects unclear tasks with specific clarification requests
- [x] Routes product-level plans to `mk:autobuild` — never directly to the developer

## Common Use Cases

| Scenario | What the planner does |
|---|---|
| "Add a search feature to the dashboard" | Produces a Standard plan with goal, acceptance criteria, scope boundaries, and implementation steps |
| "Redesign the authentication system" | Produces a Deep plan with per-phase scouting, risk assessment, and recommends routing to the architect |
| "Build a SaaS analytics dashboard" | Produces a Product-Level plan (vision, features, user stories) and routes to `mk:autobuild` |
| "Should we refactor the API or add a new endpoint?" | Produces a Two-Approach plan with comparison table for user decision |
| "Quick bug fix for the login form" | Produces a Fast plan — minimal overhead, direct to implementation |

## Pro Tips

### Match Planning Depth to Task Complexity

Do not use `--deep` for a simple bug fix, and do not use `--fast` for an authentication redesign. The planning mode should match the risk and scope of the task. When in doubt, `--hard` (the default for complex tasks) provides a good balance.

### Use Red-Team Validation for Critical Features

For any plan involving auth, payments, or user data, run `/mk:plan-creator red-team` after drafting. The 4-persona adversarial review catches blind spots that a single-pass plan misses — a security adversary, failure mode analyst, assumption destroyer, and scope critic each review the plan independently.

## Key Takeaway

The planner prevents the most expensive kind of engineering mistake: building the wrong thing, or building the right thing the wrong way. Every minute spent in planning saves hours in implementation and rework.

## Related Agents

- **[orchestrator](/reference/agents/orchestrator)** — routes tasks to the planner based on complexity classification
- **[architect](/reference/agents/architect)** — receives handoff from the planner when architectural decisions are needed
- **[developer](/reference/agents/developer)** — implements the approved plan after Gate 1
- **[tester](/reference/agents/tester)** — writes tests based on the plan's acceptance criteria (inserted before developer in TDD mode)
- **[brainstormer](/reference/agents/brainstormer)** — works alongside the planner during Phase 1 to evaluate competing solutions
