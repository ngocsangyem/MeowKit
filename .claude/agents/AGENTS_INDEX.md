# MeowKit Agents Index

## Active Agents

| Agent file | Role | Source | Workflow phases | Auto-activate? | CE version | Last improved |
|------------|------|--------|-----------------|----------------|------------|---------------|
| `orchestrator.md` | Task router, complexity classification, model tier assignment | MeowKit original | Phase 0 (Orient) | Yes — every task | 260326 | 260326 |
| `planner.md` | Two-lens planning (product + engineering), Gate 1 enforcement | MeowKit original | Phase 1 (Plan) | Routed by orchestrator | 260326 | 260326 |
| `brainstormer.md` | Solution brainstorming, architecture evaluation, trade-off analysis | Adopted from claudekit-engineer | Phase 1 (Plan) | Routed by orchestrator or explicit | 260326 | 260326 |
| `researcher.md` | Technology research, library evaluation, documentation gathering | Adopted from claudekit-engineer | Phase 0, 1, 4 | Routed by orchestrator or explicit | 260326 | 260326 |
| `architect.md` | ADR generation, system design, architecture review | MeowKit original | Phase 1 (Plan) | Routed by orchestrator for complex tasks | 260326 | 260326 |
| `tester.md` | TDD enforcement, red/green/refactor phases | MeowKit original | Phase 2 (Test RED) | Routed by orchestrator | 260326 | 260326 |
| `security.md` | Security audit, BLOCK verdicts, platform-specific rules | MeowKit original | Phase 2, 4 | Auto on auth/payments/security changes | 260326 | 260326 |
| `developer.md` | Implementation (TDD), self-healing, production code | MeowKit original | Phase 3 (Build GREEN) | Routed by orchestrator after tester | 260326 | 260326 |
| `reviewer.md` | 5-dimension code review, Gate 2 enforcement | MeowKit original | Phase 4 (Review) | Routed by orchestrator after developer | 260326 | 260326 |
| `shipper.md` | Deployment pipeline, conventional commits, PR creation | MeowKit original | Phase 5 (Ship) | Routed by orchestrator after Gate 2 | 260326 | 260326 |
| `documenter.md` | Living documentation, changelog generation, docs sync | MeowKit original | Phase 6 (Reflect) | Routed by orchestrator after ship | 260326 | 260326 |
| `analyst.md` | Cost tracking, pattern extraction, lessons learned | MeowKit original | Phase 0, 6 | Auto at session start/end | 260326 | 260326 |
| `journal-writer.md` | Failure documentation, root cause analysis, lessons | Adopted from claudekit-engineer | Phase 6 (Reflect), escalations | On failure/escalation | 260326 | 260326 |

**CE version**: Context Engineering version — tracks when agents were last improved with context engineering principles.

## Context Engineering Sections

Every agent now includes these sections (where applicable):

| Section | Purpose | Principle | Present in |
|---------|---------|-----------|------------|
| Required Context | What to load before invoking | CW3 — just-in-time context | All 13 agents |
| Failure Behavior | What to do when task cannot complete | AI4 — explicit failure path | 10 agents (pipeline agents) |
| Ambiguity Resolution | How to handle unclear inputs | AI7 — ambiguity protocol | 5 HIGH-priority agents |

## Skipped Agents

| Agent | Source | Score /40 | Reason skipped |
|-------|--------|-----------|----------------|
| code-reviewer | claudekit-engineer | 23 | MeowKit's reviewer.md is higher quality (5 dimensions + Gate 2 enforcement) |
| fullstack-developer | claudekit-engineer | 25 | MeowKit's developer.md covers this with TDD integration and self-healing |
| planner (CK) | claudekit-engineer | 23 | MeowKit's planner.md covers this with Gate 1 enforcement and two-lens review |
| ui-ux-designer | claudekit-engineer | 27 | Fills a gap but relies on 6 CK-specific skills not available in MeowKit |
| git-manager | claudekit-engineer | 22 | MeowKit's shipper.md covers git operations as part of the ship pipeline |
| architect (AF) | aura-frog | 15 | MeowKit's architect.md already covers ADRs and architecture review |
| lead (AF) | aura-frog | 13 | MeowKit's orchestrator.md already covers team coordination and routing |
| router (AF) | aura-frog | 13 | MeowKit's orchestrator.md already covers task routing and complexity classification |

## Role Conflicts Resolved

| Role | Agents that overlap | Resolution |
|------|---------------------|------------|
| Code review | CK code-reviewer vs MeowKit reviewer | Kept MeowKit reviewer — has Gate 2 enforcement and 5-dimension structure |
| Implementation | CK fullstack-developer vs MeowKit developer | Kept MeowKit developer — has TDD integration and exclusive file ownership |
| Planning | CK planner vs MeowKit planner | Kept MeowKit planner — has Gate 1 enforcement and plan template integration |
| Task routing | AF router/lead vs MeowKit orchestrator | Kept MeowKit orchestrator — has model tier routing and cost-awareness |
| Architecture | AF architect vs MeowKit architect | Kept MeowKit architect — has ADR template and exclusive docs/architecture/ ownership |
| Git operations | CK git-manager vs MeowKit shipper | Kept MeowKit shipper — covers git as part of the full ship pipeline |
| Brainstorming | CK brainstormer vs none | ADOPTED — fills critical gap in pre-planning evaluation |
| Research | CK researcher vs none | ADOPTED — fills critical gap in technology evaluation |
| Failure journals | CK journal-writer vs none | ADOPTED — fills gap in Phase 6 failure documentation |

## Coverage Gaps (Phases Without Agents)

All phases (0-6) now have agent coverage.

**Unfilled role gaps (not phase gaps):**
- **UI/UX Design** — No agent covers frontend design review, design system maintenance, or visual QA. The ui-ux-designer from claudekit-engineer was evaluated (score: 27) but depends on 6 CK-specific skills. Flagged for future adoption when MeowKit adds design-related skills.
