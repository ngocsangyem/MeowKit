---
title: Workflow Phases (0-6)
description: Detailed breakdown of each phase — deliverables, agents, hooks, and execution modes.
persona: B
---

> **See also:** [Workflow Phases](/core-concepts/workflow) — the canonical, concise 7-phase reference.

# Workflow Phases — In Detail

This page expands each phase with agent details, deliverables, and hook enforcement. For the canonical overview (one sentence per phase), see the [core concepts page](/core-concepts/workflow).

## Phase 0 — Orient

**Agent:** orchestrator, analyst
**Deliverable:** Model tier assignment, execution mode, context loaded, scout summary presented

- Read `docs/project-context.md` (agent constitution — auto-injected by `project-context-loader.sh`)
- Read relevant topic files on-demand (consumer skills handle this at task start)
- Run `mk:scale-routing` for domain-based complexity classification
- Load stack-relevant skills only (lazy loading)
- Print cost estimate before starting
- **Scout-first contract (v2.9.10+):** in `mk:cook`, present a 3–6 bullet codebase-context summary to the user before any clarifying question — project type / language / framework, relevant modules, current patterns, in-flight plans, public APIs/schemas. Skipped on `plan.md` / `phase-*.md` input.

**Navigation help:** `/mk:help` scans plans, reviews, tests, and git to determine pipeline state and prints the next action.

## Phase 1 — Plan

**Agent:** planner
**Deliverable:** `tasks/plans/YYMMDD-name/plan.md`

- `mk:plan-creator` — full plan creation (9-step workflow). Modes: `--fast`, `--hard`, `--deep`, `--parallel`, `--two`, `--product-level`, `--spike --timebox <duration>`. See [Plan Creator Modes and Flags](/core-concepts/plan-creator-modes-and-flags).
- `mk:plan-ceo-review` — product lens + engineering lens
- `mk:validate-plan` — 8-dimension quality check for COMPLEX tasks
- For COMPLEX tasks (5+ files): bead decomposition — atomic, independently committable work units
- **Exact-requirements contract (v2.9.10+):** in `mk:cook`, plan-creator MUST answer 5 dimensions in concrete sentences before returning a plan — expected output, acceptance criteria, scope boundary, non-negotiable constraints, touchpoints (files from scout). Clarifying-question options MUST cite scout findings (file paths); abstract options are a failure mode. Skipped on plan-path input.

**Gate 1:** Human approval required. `gate-enforcement.sh` blocks all file writes until plan is approved. In non-auto modes `validate-gate-1.sh` runs as an advisory preflight (surfaces structural-check failures to the user; user retains override). In `--auto` mode it remains blocking.

## Phase 2 — Test

**Agent:** tester
**Deliverable:** Tests (failing in TDD mode; optional otherwise)

- **TDD mode** (`--tdd` / `MEOWKIT_TDD=1`): failing tests first. `pre-implement.sh` blocks if no failing test exists. `--tdd` is a flag, not a planning mode; it composes with the selected plan-creator mode.
- **Default mode:** Phase 2 is optional. Tester invoked on-request.
- `mk:nyquist` verifies test-to-requirement coverage at end of phase.
- Security pre-check always runs.

## Phase 3 — Build

**Agent:** developer
**Deliverable:** Passing implementation

- Implement until tests pass
- `post-write.sh` hook: security scan on every file write
- Self-heal: auto-fix up to 3 attempts, each using a different approach
- For COMPLEX tasks: bead processing — commit after each bead, resume from last uncommitted bead
- For harness runs in FULL density: signed sprint contract required before source writes

## Phase 4 — Review

**Agent:** reviewer
**Deliverable:** `tasks/reviews/YYMMDD-name-verdict.md`

- 5-dimension audit: architecture, types, security, tests, performance
- Optional pre-review: `mk:scout` for edge case detection
- Optional post-verdict: `mk:elicit` for deeper analysis on WARN dimensions

**Gate 2:** Human approval required in all modes — see `.claude/rules/gate-rules.md`. FAIL blocks Phase 5.

**Regression-recovery pattern (v2.9.10+):** when the reviewer surfaces a regression in EXISTING behavior (verdict appends `Side Effects Detected: Yes` plus bullet effects), cook STOPs the iteration loop and presents 2–4 typed options to the user — revert + re-plan / keep + update dependents / compatibility shim / accept the regression. User selection is recorded as a `## User Decision Addendum` block on the verdict file. `validate-gate-2.sh` blocks Gate 2 until the addendum is present (positive-presence-only — absence of the field is never a block).

**Workflow evidence index (v2.9.13+):** `mk:cook` and `mk:fix` populate one `workflow-evidence.json` per run — a traceable index of task, risk flags, diagnosis/contract, verification, verdict path, and approvals. It mirrors `validate-gate-1.sh` / `validate-gate-2.sh` (the gate scripts stay authoritative) and **never approves anything**; the validator `validate-workflow-evidence.cjs` checks completeness before Gate 2 is presented, and the contract loads on demand from `.claude/rules-conditional/workflow-evidence-rules.md`. `mk:fix --auto` no longer self-approves from a review score — it stops at *ready for user approval*.

**Optional flags** (cook only):
- `--verify` `[LIGHT]`: light browser/artifact check, **advisory** (no back-edge to Phase 3 — FAIL is reported but does not block ship)
- `--strict` `[HEAVY]`: full evaluator pass, **blocking** (FAIL blocks ship and routes back to Phase 3, max 2 evaluator iterations)

Concrete cost of `[LIGHT]` vs `[HEAVY]` depends on the inner harness, model tier, and target surface; treat the labels as relative ordering only.

## Phase 5 — Ship

**Agent:** shipper
**Deliverable:** PR URL + rollback documentation

- `pre-ship.sh`: full test + lint + typecheck
- Pre-flight reads the workflow evidence index when present (after `mk:verify`, which keeps abort authority) — augments proof, never overrides a verify FAIL (v2.9.13+)
- Conventional commit (auto-generated)
- PR — never push to main directly
- Verify CI passes before closing

## Phase 6 — Reflect

**Agent:** documenter, analyst
**Deliverable:** Updated memory + documentation

- Extract learnings as patterns, decisions, or failures
- Update `.claude/memory/` topic files
- Sync affected documentation
- Close sprint task

## Execution modes

| Mode | When | How |
|------|------|-----|
| Sequential | Default | One phase at a time |
| Parallel | COMPLEX with independent subtasks | Up to 3 agents in isolated git worktrees |
| Party | Architecture decisions | 2-4 agents deliberate, forced synthesis |

## Plan-first gate pattern

| Skill | Gate behavior | Skip condition |
|-------|-------------|----------------|
| `mk:cook` | Create plan if missing | Plan path arg, `--fast` |
| `mk:fix` | Plan if > 2 files | `--quick` |
| `mk:ship` | Require approved plan | Hotfix with human approval |
| `mk:cso` | Scope audit via plan | `--daily` |
| `mk:review` | Read plan for context | PR diff reviews |

Skills that skip: `mk:investigate` and `mk:office-hours` (produce planning input, run before plan exists); `mk:retro` (data-driven, no implementation).

## Next steps

- [Build a feature](/guides/build-a-feature) — the full cook pipeline
- [How gates work](/core-concepts/gates) — enforcement details
