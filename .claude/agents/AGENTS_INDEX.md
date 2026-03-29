# MeowKit Agents Index

## Active Agents

| Agent file | Role | Source | Workflow phases | Auto-activate? | CE version | Last improved |
|------------|------|--------|-----------------|----------------|------------|---------------|
| `orchestrator.md` | Task router, complexity classification, model tier assignment | MeowKit original | Phase 0 (Orient) | Yes — every task | 260326 | 260326 |
| `planner.md` | Two-lens planning (product + engineering), Gate 1 enforcement | MeowKit original | Phase 1 (Plan) | Routed by orchestrator | 260326 | 260326 |
| `brainstormer.md` | Solution brainstorming, architecture evaluation, trade-off analysis | Credit: Duy Nguyen | Phase 1 (Plan) | Routed by orchestrator or explicit | 260326 | 260326 |
| `researcher.md` | Technology research, library evaluation, documentation gathering | Credit: Duy Nguyen | Phase 0, 1, 4 | Routed by orchestrator or explicit | 260326 | 260326 |
| `architect.md` | ADR generation, system design, architecture review | MeowKit original | Phase 1 (Plan) | Routed by orchestrator for complex tasks | 260326 | 260326 |
| `tester.md` | TDD enforcement, red/green/refactor phases | MeowKit original | Phase 2 (Test RED) | Routed by orchestrator | 260326 | 260326 |
| `security.md` | Security audit, BLOCK verdicts, platform-specific rules | MeowKit original | Phase 2, 4 | Auto on auth/payments/security changes | 260326 | 260326 |
| `developer.md` | Implementation (TDD), self-healing, production code | MeowKit original | Phase 3 (Build GREEN) | Routed by orchestrator after tester | 260326 | 260326 |
| `reviewer.md` | 5-dimension code review, Gate 2 enforcement | MeowKit original | Phase 4 (Review) | Routed by orchestrator after developer | 260326 | 260326 |
| `shipper.md` | Deployment pipeline, conventional commits, PR creation | MeowKit original | Phase 5 (Ship) | Routed by orchestrator after Gate 2 | 260326 | 260326 |
| `documenter.md` | Living documentation, changelog generation, docs sync | MeowKit original | Phase 6 (Reflect) | Routed by orchestrator after ship | 260326 | 260326 |
| `analyst.md` | Cost tracking, pattern extraction, lessons learned | MeowKit original | Phase 0, 6 | Auto at session start/end | 260326 | 260326 |
| `journal-writer.md` | Failure documentation, root cause analysis, lessons | Credit: Duy Nguyen | Phase 6 (Reflect), escalations | On failure/escalation | 260326 | 260326 |
| `git-manager.md` | Git operations: stage, commit, push with conventional commits | Adapted from claudekit-engineer | Phase 5 (Ship), any | On "commit"/"push" request | 260329 | 260329 |

**CE version**: Context Engineering version — tracks when agents were last improved with context engineering principles.

## Context Engineering Sections

Every agent now includes these sections (where applicable):

| Section | Purpose | Principle | Present in |
|---------|---------|-----------|------------|
| Required Context | What to load before invoking | CW3 — just-in-time context | All 15 agents |
| Failure Behavior | What to do when task cannot complete | AI4 — explicit failure path | 10 agents (pipeline agents) |
| Ambiguity Resolution | How to handle unclear inputs | AI7 — ambiguity protocol | 5 HIGH-priority agents |

## Coverage Gaps

All phases (0-6) have agent coverage.

**No unfilled role gaps.** All phases (0-6) and all operational roles have agent coverage.
