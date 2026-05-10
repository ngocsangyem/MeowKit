---
title: orchestrator
description: Task router — classifies complexity, assigns model tier, detects TDD mode, and routes every request to the right specialist agent.
---

# orchestrator

The orchestrator is the front door of every MeowKit workflow. Before any code is written, any plan is drafted, or any review is conducted, the orchestrator steps in to understand what you are asking for and decides who should handle it. Think of it as a project intake coordinator — it reads the room, sizes up the task, and assigns the right team.

## Cognitive Framing

> *"Every task starts here. The orchestrator never writes code — it decides who does."*

The orchestrator operates at Phase 0 (Orient). It exists to answer three questions for every incoming task: **How complex is this?** **Which model should handle it?** **Which agents need to be involved, and in what order?** Once those answers are locked in, the orchestrator hands off and steps back.

## Key Facts

| | |
|---|---|
| **Type** | Core |
| **Phase** | 0 (Orient) |
| **Auto-activates** | Every task |
| **Never does** | Write code, modify files, grade output, downgrade complexity mid-task |

## When to Use

- At the **start of every task** — the orchestrator activates automatically; you do not need to invoke it manually.
- When you need to **understand how a task will be routed** through the pipeline.
- When a task involves **ambiguity** and needs a clear complexity classification before work begins.

You typically do not interact with the orchestrator directly. It runs behind the scenes to ensure your request lands with the right specialist.

## Key Capabilities

- **Complexity classification** — every task is assigned one of three tiers: Trivial (single-file, no architectural impact), Standard (multi-file, within existing patterns), or Complex (cross-cutting, new patterns, architectural decisions).
- **Model tier assignment** — Trivial tasks use the cheapest model, Standard tasks use the default, Complex tasks use the best available. Auth, payments, and user-data changes always escalate to Complex.
- **Domain-based routing** — before manual classification, the orchestrator scans for domain keywords using `mk:scale-routing` and overrides classification when a match is found.
- **TDD mode detection** — checks environment variables and sentinel files to determine whether test-driven development is active, then adjusts the agent sequence accordingly.
- **Agent sequence planning** — defines the execution order for every task (e.g., planner → tester → developer → reviewer → shipper → documenter → analyst).
- **Parallel execution** — for Complex tasks with independent subtasks, the orchestrator can decompose into 2–3 parallel agent tracks using git worktrees.
- **Party mode** — routes architectural trade-off discussions to multi-agent collaboration sessions.

## Behavioral Checklist

- [x] Classifies complexity before any work begins
- [x] Assigns model tier based on complexity — never downgrades mid-task
- [x] Detects TDD mode from environment variables and sentinel files
- [x] Enforces Gate 1 (plan required) for Standard and Complex tasks
- [x] Enforces Gate 2 (review required) for all code changes
- [x] Reads memory files at session start for prior learnings and budget context
- [x] Asks one targeted clarifying question when task is ambiguous — never guesses
- [x] Routes to `mk:harness` for green-field product builds instead of the standard pipeline

## Common Use Cases

| Scenario | What the orchestrator does |
|---|---|
| "Fix this typo in the README" | Classifies as Trivial, routes directly to a specialist |
| "Add user authentication" | Classifies as Complex (auth = always Complex), routes through full pipeline with security agent at Phase 2 and Phase 4 |
| "Build me a kanban app" | Detects green-field product build, routes to `mk:harness` instead of the standard pipeline |
| "Should we use WebSockets or SSE?" | Detects trade-off language, routes to Party mode for multi-agent discussion |
| "Refactor the API layer" | Classifies as Standard or Complex based on scope, inserts architect after planner if API contracts change |

## Routing Table

| Complexity | Model | Agent Sequence | Examples |
|---|---|---|---|
| Trivial | Cheapest | Direct to specialist | Rename, typo, format |
| Standard | Default | Planner → Tester → Developer → Reviewer → Shipper → Documenter → Analyst | Feature (<5 files), bug fix |
| Complex | Best | Planner → Architect → Security → Tester → Developer → Security → Reviewer → Shipper → Documenter → Analyst | Architecture, auth, payments |

## Planning Depth

| Mode | Researchers | Parallel | Two Approaches | Per-Phase Scout |
|---|---|---|---|---|
| default | 1 | No | No | No |
| strict | 2 | Yes | Yes | No |
| fast | 0 (skip) | No | No | No |
| architect | 2 | Yes | Yes | No |
| deep | 1 per phase | No | No | Yes |
| cost-saver | 0 (skip) | No | No | No |

## Pro Tips

### Understand Escalation Rules

Auth, payments, user data, and infrastructure changes are **always** classified as Complex — regardless of how small the change appears. This is intentional. Once a tier is assigned, it cannot be downgraded mid-task. This anti-rationalization rule prevents the common pattern of "it's just a small auth change" leading to insufficient review.

### Use Domain-Based Routing to Your Advantage

If your project has recurring task patterns, the orchestrator's domain-based routing (via `domain-complexity.csv`) can automatically classify tasks before manual review. This saves time on projects with well-defined complexity boundaries.

## Key Takeaway

The orchestrator ensures every task gets the right level of attention. It prevents over-engineering simple changes and under-reviewing critical ones. You never interact with it directly, but it shapes the entire workflow that follows.

## Related Agents

- **[planner](/reference/agents/planner)** — receives tasks from the orchestrator to produce implementation plans
- **[architect](/reference/agents/architect)** — inserted by the orchestrator when architectural decisions are needed
- **[security](/reference/agents/security)** — inserted by the orchestrator for auth, payment, and security-sensitive changes
- **[analyst](/reference/agents/analyst)** — provides cost context that informs model tier decisions
