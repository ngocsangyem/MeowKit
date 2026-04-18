---
name: meow:workflow-orchestrator
description: "Execute 7-phase workflow for complex features. Includes fasttrack mode for pre-approved specs. DO NOT use for simple bug fixes."
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

## Plan-First Gate

Orchestrator enforces the plan-first pattern for all workflows:

1. On task received → check for existing approved plan
2. If no plan and task is non-trivial → route to `meow:plan-creator` first
3. After Gate 1 approval → select workflow model and execute phases

Skip: Fasttrack mode with pre-approved spec.

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

See CLAUDE.md and Phase Composition Contracts for input/output expectations per phase.

1. **Run pre-execution checklist** — select lead agent, load memory, show agent banner, verify complexity, challenge requirements.

2. **Detect workflow mode** — check for `fasttrack:` prefix or Agent Teams trigger; if present load `references/fasttrack-and-teams.md`. Otherwise proceed with standard 7-phase flow.

3. **Execute phases sequentially** — load `references/workflow-phases.md` then run:
   - Phase 0: Orient — model tier, execution mode, **TDD mode detection**, read memory. Auto-continue.
   - Phase 1: Plan → **GATE 1** (human approval required)
   - Phase 2: Test — in TDD mode (`--tdd` / `MEOWKIT_TDD=1`), write failing tests; in default mode, optional / on-request only. Auto-continue.
   - Phase 3: Build — implement per the plan. In TDD mode, code must make failing tests pass. Auto-continue.
   - Phase 3.5: Simplify — run `meow:simplify` after build (after tests pass in TDD mode). **MANDATORY before Phase 4.** Auto-continue.
   - Phase 4: Review — quality/security audit → **GATE 2** (human approval required, NO EXCEPTIONS)
   - Phase 5: Ship — commit, PR, deploy. Auto-continue.
   - Phase 6: Reflect — memory capture, docs sync. Auto-complete.

4. **At each phase boundary** — check token budget (warn at 75%, handoff at 90%). Show what comes next before continuing. Save state via `workflow:handoff` if context is near limit.

**Only 2 approval gates:** Phase 1 (Plan) and Phase 4 (Review). Everything else auto-continues.

## References

| Reference                                                         | When to load                                     | Content                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| **[workflow-phases.md](./references/workflow-phases.md)**         | Steps 2-6 — executing phases                     | Phase details, transition rules, approval gates, token budgets, TDD rules   |
| **[fasttrack-and-teams.md](./references/fasttrack-and-teams.md)** | Only if fasttrack trigger or Agent Teams enabled | Fast-track mode, spec validation, Agent Teams composition, state management |

## Key Rules

- **TDD is OPT-IN** (post-migration): default mode skips Phase 2 RED gate; enable with `--tdd` or `MEOWKIT_TDD=1`. In TDD mode the cycle is RED → GREEN → REFACTOR.
- **KISS:** Simple over complex, standard patterns over custom
- **Token budget:** Target ≤30K for full workflow. Warn at 75%, handoff at 90%.
- **State:** `workflow:handoff` saves, `workflow:resume <id>` continues
- **ALWAYS show what's next** after each phase

## Related Rules

- `.claude/rules/gate-rules.md` — Gate 1 (Plan) and Gate 2 (Review) hard-stop conditions enforced by this orchestrator
- `.claude/rules/injection-rules.md` — DATA vs INSTRUCTIONS boundary; applies to all file/tool output processed during orchestration

## Gotchas

- **Parallel agents editing same file**: Two subagents modify the same source file simultaneously → Define exclusive file ownership before spawning parallel agents
- **Token budget exceeded mid-workflow**: Complex 7-phase workflow runs out of context → Check remaining context at each phase boundary; escalate if < 20% remaining
