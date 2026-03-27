---
name: meow:workflow-orchestrator
description: "Execute 5-phase workflow for complex features. Includes fasttrack mode for pre-approved specs. DO NOT use for simple bug fixes."
autoInvoke: true
priority: high
triggers:
  - "implement"
  - "build feature"
  - "create feature"
  - "workflow:start"
  - "complex task"
  - "fasttrack:"
  - "fast-track"
  - "just build it"
  - "execute from specs"
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
source: aura-frog
---

<!-- Split for progressive disclosure (checklist #11, #14): 463 → ~75 lines -->

# MeowKit Workflow Orchestrator

**Priority:** CRITICAL — Use for complex feature implementations.

## When to Use

**USE for:** New features, complex implementations, tasks >2 hours, multi-file changes, tasks requiring TDD.

**DON'T use for:** Bug fixes → `meow:fix`, quick refactors → direct edit, config changes → direct edit, simple questions → just answer.

## Pre-Execution Checklist

1. **agent-detector** → Select lead agent (MANDATORY)
2. **Load context** → Read `memory/lessons.md` + `memory/patterns.json` (Phase 0 Orient)
3. **Show agent banner** at start of response
4. **Verify task complexity** — if simple, suggest lighter approach
5. **Challenge requirements** → Ask clarifying questions before Phase 1

## Process

1. Run pre-execution checklist above
2. **Phase 1: Understand + Design** — load `references/workflow-phases.md`. APPROVAL GATE.
3. **Phase 2: Test RED** — write failing tests (TDD). Auto-continue.
4. **Phase 3: Build GREEN** — implement to pass tests. APPROVAL GATE.
5. **Phase 4: Refactor + Review** — clean code, security check. Auto-continue.
6. **Phase 5: Finalize** — verify coverage ≥80%, docs, notification. Auto-complete.

**Only 2 approval gates:** Phase 1 (Design) and Phase 3 (Build). Everything else auto-continues.

## References

| Reference                                                         | When to load                                     | Content                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| **[workflow-phases.md](./references/workflow-phases.md)**         | Steps 2-6 — executing phases                     | Phase details, transition rules, approval gates, token budgets, TDD rules   |
| **[fasttrack-and-teams.md](./references/fasttrack-and-teams.md)** | Only if fasttrack trigger or Agent Teams enabled | Fast-track mode, spec validation, Agent Teams composition, state management |

## Key Rules

- **TDD is mandatory:** RED → GREEN → REFACTOR
- **KISS:** Simple over complex, standard patterns over custom
- **Token budget:** Target ≤30K for full workflow. Warn at 75%, handoff at 90%.
- **State:** `workflow:handoff` saves, `workflow:resume <id>` continues
- **ALWAYS show what's next** after each phase

## Gotchas

- **Parallel agents editing same file**: Two subagents modify the same source file simultaneously → Define exclusive file ownership before spawning parallel agents
- **Token budget exceeded mid-workflow**: Complex 5-phase workflow runs out of context → Check remaining context at each phase boundary; escalate if < 20% remaining
