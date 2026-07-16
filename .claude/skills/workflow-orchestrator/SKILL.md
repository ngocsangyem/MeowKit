---
name: mk:workflow-orchestrator
description: Auto-invoked 7-phase workflow for complex-feature intent. Includes fasttrack mode for pre-approved specs. NOT for explicit user-invoked single tasks (see mk:cook); NOT for green-field autonomous builds (see mk:autobuild); NOT for simple bug fixes (see mk:fix).
triggers:
  - implement feature
  - build feature
  - create feature
  - workflow:start
  - complex task
  - 'fasttrack:'
  - fast-track
  - just build it
  - execute from specs
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
source: aura-frog
keywords:
  - workflow-orchestrator
  - auto-invoke
  - phase-routing
  - intent-detection
  - fasttrack
  - complex-feature
when_to_use: Auto-invoked on complex-feature intent — routes through 7-phase workflow. NOT for explicit user-invoked single tasks (see mk:cook). Not user-callable directly.
user-invocable: false
owner: lifecycle
criticality: high
status: active
runtime: claude-code
dependency_edges:
  - id: mk:agent-detector
    type: peer
  - id: mk:cook
    type: peer
  - id: mk:fix
    type: peer
  - id: mk:plan-creator
    type: peer
  - id: mk:simplify
    type: peer
  - id: mk:verify
    type: peer
---

<!-- Split for progressive disclosure (checklist #11, #14): 463 → ~75 lines -->

# Workflow Orchestrator

<!-- Canonical source: .claude/workflow.yaml -->

**Priority:** CRITICAL — Use for complex feature implementations.

> Only activates on session start for complex-feature intent. If `/mk:cook` was explicitly invoked in this session, do not activate — `mk:cook` owns the pipeline. See `.claude/rules/orchestration-rules.md`"Orchestrator Entry Point Rule".

## Canonical Lifecycle

`.claude/workflow.yaml` is the sole source for phase sequence, gates, leads, and required outputs. This adapter must not restate phase details. For execution load `references/workflow-phases.md`, which renders that contract.

On a non-trivial task, route to `mk:plan-creator`; proceed only after Gate 1. Fasttrack accepts only a pre-approved spec. Gate 2 remains human approval before an explicit ship request.

## When to Use

**USE for:** New features, complex implementations, tasks >2 hours, multi-file changes, tasks requiring TDD.

**DON'T use for:** Bug fixes → `mk:fix`, quick refactors → direct edit, config changes → direct edit, simple questions → just answer.

## Pre-Execution Checklist

1. **agent-detector** → Select lead agent (MANDATORY)
2. **Load context** → Read canonical `.claude/memory/fixes.json` + `.claude/memory/architecture-decisions.json` (Phase 0 Orient; fall back to matching `.md` views only when JSON is absent)
3. **Show agent banner** at start of response
4. **Verify task complexity** — if simple, suggest lighter approach
5. **Challenge requirements** → Ask clarifying questions before Phase 1

## Process

See `.claude/rules/phase-contracts.md` for input/output expectations per phase. (Loaded by `mk:agent-detector` Step 0b at session start.)

1. **Run pre-execution checklist** — select lead agent, load memory, show agent banner, verify complexity, challenge requirements.

2. **Detect workflow mode** — check for `fasttrack:` prefix or Agent Teams trigger; if present load `references/fasttrack-and-teams.md`. Otherwise proceed with standard 7-phase flow.

3. **Execute the canonical lifecycle** — load `references/workflow-phases.md` and follow `.claude/workflow.yaml`; do not duplicate or override its phase ordering, TDD rules, required outputs, or gates.

4. **At each phase boundary** — check token budget (warn at 75%, handoff at 90%). Show what comes next before continuing. Save state via `workflow:handoff` if context is near limit. Also delegate to `project-manager` after each phase transition per `.claude/rules/post-phase-delegation.md` Rule 1 (background, non-blocking — include "Run in the background" in the prompt). Skipped when `MEOWKIT_PM_AUTO=off`.

Only the canonical gates authorize transition. Shipping and reflection require explicit user direction; they do not auto-run after review.

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
