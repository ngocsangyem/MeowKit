---
title: orchestrator
description: "Task router that classifies complexity, assigns model tier, and routes every incoming request to the right specialist agent."
---

# orchestrator

Task router that classifies complexity, assigns model tier, and routes every incoming request to the right specialist agent.

## Overview

The orchestrator is the entry point for every task in MeowKit. No task bypasses it. When you give Claude a task, the orchestrator classifies its complexity (Trivial / Standard / Complex), assigns the appropriate model tier (Haiku / Sonnet / Opus), and routes to the correct specialist agent sequence. It enforces both hard gates and reads past session data to make informed routing decisions.

The orchestrator never writes code, tests, or docs. It only makes routing decisions.

## Quick Reference

### Routing & Classification

| Complexity | Model tier | Agent sequence | Example tasks |
|-----------|-----------|---------------|---------------|
| **Trivial** | Haiku (cheapest) | Direct to specialist | Rename, typo, format, version bump |
| **Standard** | Sonnet (default) | Planner → Tester → Developer → Reviewer → Shipper | Feature (<5 files), bug fix, test writing |
| **Complex** | Opus (best) | Planner → Architect → Tester → Developer → Reviewer → Shipper | Architecture, security, auth/payments, multi-module |

### Security Escalation

Tasks touching auth, payments, user data, or infrastructure **always** escalate to Complex tier and insert the Security agent at Phase 2 and Phase 4.

### Pipeline Gates

| Gate | When | What it blocks |
|------|------|---------------|
| Gate 1 | After planner (Phase 1) | No implementation without approved plan |
| Gate 2 | After reviewer (Phase 4) | No shipping without approved review |

## How to Use

The orchestrator activates automatically on every task — you never invoke it explicitly.

```
You: "Add user authentication with JWT"
Orchestrator: Task complexity: COMPLEX → using Opus
              Routing: planner → architect → tester → developer → reviewer → shipper
              Security agent inserted at Phase 2 and Phase 4 (auth-related)
```

```
You: "Fix typo in README line 42"
Orchestrator: Task complexity: TRIVIAL → using Haiku
              Routing: direct edit (no pipeline needed)
```

## Under the Hood

### Orchestration Patterns

The orchestrator reads two files at session start to inform routing:

- **`memory/lessons.md`** — Past patterns that affect routing (e.g., "this codebase has flaky auth tests → always include security agent")
- **`memory/cost-log.json`** — Token usage history (avoids over-classifying routine tasks to expensive tiers)

### Agent Communication

The orchestrator communicates through explicit routing declarations:

```
Task complexity: [TRIVIAL|STANDARD|COMPLEX] → using [model tier]
Agent sequence: [agent1] → [agent2] → ... → [agentN]
```

Every downstream agent knows its position in the sequence and what comes next.

### Handoff Example

**Standard feature request:**
```
User: "Add pagination to the user list API"

Orchestrator output:
  Task complexity: STANDARD → using Sonnet
  Routing: planner → tester → developer → reviewer → shipper → documenter → analyst
  Gate 1: Plan approval required before Phase 2
  Gate 2: Review approval required before Phase 5
```

**Escalation (auth-related):**
```
User: "Add OAuth2 login flow"

Orchestrator output:
  Task complexity: COMPLEX → using Opus
  Routing: planner → architect → security(Phase2) → tester → developer →
           security(Phase4) → reviewer → shipper → documenter → analyst
  Security: Auto-inserted (auth-related change)
```

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Task over-classified as COMPLEX | Orchestrator being cautious | Accept — security-sensitive tasks always Complex |
| Agent fails after delegation | Downstream agent timeout or error | Orchestrator reports failure, suggests re-run or alternative |
| Wrong agent selected | Ambiguous task description | Be more specific in task description |
| Gate 1 blocking when it shouldn't | Only `/meow:fix` with simple complexity can skip Gate 1 | If task is truly trivial, use `/meow:fix --quick` |
