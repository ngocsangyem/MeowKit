# MeowKit Agents Index

## Active Agents

| Agent file | Type | Role | Source | Workflow phases | Auto-activate? | CE version | Last improved |
|------------|------|------|--------|-----------------|----------------|------------|---------------|
| `orchestrator.md` | Core | Task router, complexity classification, model tier assignment | MeowKit original | Phase 0 (Orient) | Yes — every task | 260326 | 260326 |
| `planner.md` | Core | Two-lens planning (product + engineering) + product-level mode for green-field builds, Gate 1 enforcement | MeowKit original | Phase 1 (Plan) | Routed by orchestrator | 260326 | 260408 |
| `brainstormer.md` | Support | Solution brainstorming, architecture evaluation, trade-off analysis | Credit: Duy Nguyen | Phase 1 (Plan) | Routed by orchestrator or explicit | 260326 | 260326 |
| `researcher.md` | Support | Technology research, library evaluation, documentation gathering | Credit: Duy Nguyen | Phase 0, 1, 4 | Routed by orchestrator or explicit | 260326 | 260326 |
| `architect.md` | Core | ADR generation, system design, architecture review | MeowKit original | Phase 1 (Plan) | Routed by orchestrator for complex tasks | 260326 | 260326 |
| `tester.md` | Core | Test writing; TDD enforcement (red/green/refactor) when `--tdd` / `MEOWKIT_TDD=1`; non-blocking test writing in default mode | MeowKit original | Phase 2 (Test) | Routed by orchestrator (always in TDD mode; on-request in default mode) | 260326 | 260409 |
| `security.md` | Core | Security audit, BLOCK verdicts, platform-specific rules | MeowKit original | Phase 2, 4 | Auto on auth/payments/security changes | 260326 | 260326 |
| `developer.md` | Core | Implementation per approved plan; strict TDD when `--tdd` / `MEOWKIT_TDD=1`; direct implementation in default mode; self-healing | MeowKit original | Phase 3 (Build) | Routed by orchestrator (after tester in TDD mode; directly after planner in default mode) | 260326 | 260409 |
| `ui-ux-designer.md` | Support | UI design, design systems, accessibility, responsive layouts | MeowKit original | Phase 3 (Build GREEN) | Routed when frontend detected | 260326 | 260330 |
| `reviewer.md` | Core | 5-dimension code review, Gate 2 enforcement, adversarial personas, artifact verification | MeowKit original | Phase 4 (Review) | Routed by orchestrator after developer | 260326 | 260331 |
| `evaluator.md` | Core | Behavioral active-verification of running builds against rubric library; skeptic persona; produces graded verdict with concrete runtime evidence (screenshots/curl/CLI). Distinct from reviewer (structural). | MeowKit original | Phase 3 (active verification) + Phase 4 (contract reviewer) | Routed by harness after generator iteration; explicit via /mk:evaluate | 260408 | 260408 |
| `shipper.md` | Core | Deployment pipeline, conventional commits, PR creation | MeowKit original | Phase 5 (Ship) | Routed by orchestrator after Gate 2 | 260326 | 260326 |
| `git-manager.md` | Support | Git operations: stage, commit, push with conventional commits | Adapted from claudekit-engineer | Phase 5 (Ship), any | On "commit"/"push" request | 260329 | 260329 |
| `documenter.md` | Core | Living documentation, changelog generation, docs sync | MeowKit original | Phase 6 (Reflect) | Routed by orchestrator after ship | 260326 | 260326 |
| `analyst.md` | Core | Cost tracking, pattern extraction, lessons learned | MeowKit original | Phase 0, 6 | Auto at session start/end | 260326 | 260326 |
| `journal-writer.md` | Support | Failure documentation, root cause analysis, lessons | Credit: Duy Nguyen | Phase 6 (Reflect), escalations | On failure/escalation | 260326 | 260326 |
| `project-manager.md` | Core | Cross-workflow delivery tracking, evidence-based status reports | MeowKit original | on-demand (0–6) | Explicit delegation, `/mk:status`, or `post-phase-delegation.md` rule | 260422 | 260422 |

**CE version**: Context Engineering version — tracks when agents were last improved with context engineering principles.

## Context Engineering Sections

Every agent now includes these sections (where applicable):

| Section | Purpose | Principle | Present in |
|---------|---------|-----------|------------|
| Required Context | What to load before invoking | CW3 — just-in-time context | All 17 agents |
| Failure Behavior | What to do when task cannot complete | AI4 — explicit failure path | 17 agents (pipeline + evaluator, ui-ux-designer, git-manager, project-manager) |
| Ambiguity Resolution | How to handle unclear inputs | AI7 — ambiguity protocol | 5 HIGH-priority agents |

## Coverage Gaps

All phases (0-6) have agent coverage.

**No unfilled role gaps.** All phases (0-6) and all operational roles have agent coverage.

## Agent Types

- **Core** — Pipeline agents that execute sequentially through phases 0-6. Each owns a distinct workflow phase.
- **Support** — Invoked on-demand by core agents or explicitly by user. Can be spawned as subagents.

## Subagent Status Protocol (v1.1.0)

All subagents MUST end responses with structured status. See `output-format-rules.md` Rule 5.
