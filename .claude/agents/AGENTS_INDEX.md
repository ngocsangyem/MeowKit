# the toolkit Agents Index

## Active Agents

```toon
[34]{agent_file,type,role,source,workflow_phases,auto_activate,ce_version,last_improved}
`orchestrator.md`|Core|Task router, complexity classification, model tier assignment|original|Phase 0 (Orient)|Yes — every task|260326|260326
`planner.md`|Core|Two-lens planning (product + engineering) + product-level mode for green-field builds, Gate 1 enforcement|original|Phase 1 (Plan)|Routed by orchestrator|260326|260408
`brainstormer.md`|Support|Solution brainstorming, architecture evaluation, trade-off analysis|Credit: Duy Nguyen|Phase 1 (Plan)|Routed by orchestrator or explicit|260326|260326
`researcher.md`|Support|Technology research, library evaluation, documentation gathering|Credit: Duy Nguyen|Phase 0, 1, 4|Routed by orchestrator or explicit|260326|260326
`architect.md`|Core|ADR generation, system design, architecture review|original|Phase 1 (Plan)|Routed by orchestrator for complex tasks|260326|260326
`tester.md`|Core|Test writing; TDD enforcement (red/green/refactor) when `--tdd` / `MEOWKIT_TDD=1`; non-blocking test writing in default mode|original|Phase 2 (Test)|Routed by orchestrator (always in TDD mode; on-request in default mode)|260326|260409
`security.md`|Core|Security audit, BLOCK verdicts, platform-specific rules|original|Phase 2, 4|Auto on auth/payments/security changes|260326|260326
`developer.md`|Core|Implementation per approved plan; strict TDD when `--tdd` / `MEOWKIT_TDD=1`; direct implementation in default mode; self-healing|original|Phase 3 (Build)|Routed by orchestrator (after tester in TDD mode; directly after planner in default mode)|260326|260409
`ui-ux-designer.md`|Support|UI design, design systems, accessibility, responsive layouts|original|Phase 3 (Build GREEN)|Routed when frontend detected|260326|260330
`reviewer.md`|Core|5-dimension code review, Gate 2 enforcement, adversarial personas, artifact verification|original|Phase 4 (Review)|Routed by orchestrator after developer|260326|260331
`evaluator.md`|Core|Behavioral active-verification of running builds against rubric library; skeptic persona; produces graded verdict with concrete runtime evidence (screenshots/curl/CLI). Distinct from reviewer (structural).|original|Phase 3 (active verification) + Phase 4 (contract reviewer)|Routed by harness after generator iteration; explicit via /mk:evaluate|260408|260408
`shipper.md`|Core|Deployment pipeline, conventional commits, PR creation|original|Phase 5 (Ship)|Routed by orchestrator after Gate 2|260326|260326
`git-manager.md`|Support|Git operations: stage, commit, push with conventional commits|Adapted from external skill patterns|Phase 5 (Ship), any|On "commit"/"push" request|260329|260329
`documenter.md`|Core|Living documentation, changelog generation, docs sync|original|Phase 6 (Reflect)|Routed by orchestrator after ship|260326|260326
`analyst.md`|Core|Cost tracking, pattern extraction, lessons learned|original|Phase 0, 6|Auto at session start/end|260326|260326
`journal-writer.md`|Support|Failure documentation, root cause analysis, lessons|Credit: Duy Nguyen|Phase 6 (Reflect), escalations|On failure/escalation|260326|260326
`project-manager.md`|Core|Cross-workflow delivery tracking, evidence-based status reports|original|on-demand (0–6)|Explicit delegation, `/mk:status`, or `post-phase-delegation.md` rule|260422|260422
`jira-issue.md`|Domain|JIRA issue CRUD via jira-as wrapper (create/get/update/delete)|Adapted from JIRA-Assistant-Skills v4.0.1|on-demand|Forked from `mk:jira-issue` skill|260510|260510
`jira-search.md`|Domain|JIRA search + filter management via jira-as (JQL query/validate/build/export, saved filters)|Adapted from JIRA-Assistant-Skills v4.0.1|on-demand|Forked from `mk:jira-search` skill|260510|260510
`jira-lifecycle.md`|Domain|Workflow lifecycle: transition / assign / resolve / reopen / version / component|Adapted from JIRA-Assistant-Skills v4.0.1|on-demand|Forked from `mk:jira-lifecycle` skill|260510|260510
`jira-collaborate.md`|Domain|Comments, attachments, watchers, notifications|Adapted from JIRA-Assistant-Skills v4.0.1|on-demand|Forked from `mk:jira-collaborate` skill|260510|260510
`jira-relationships.md`|Domain|Issue links, blockers, dependencies, clone, bulk-link|Adapted from JIRA-Assistant-Skills v4.0.1|on-demand|Forked from `mk:jira-relationships` skill|260510|260510
`jira-time.md`|Domain|Time tracking: log / worklogs / estimates / reports / bulk-log|Adapted from JIRA-Assistant-Skills v4.0.1|on-demand|Forked from `mk:jira-time` skill|260510|260510
`jira-agile.md`|Domain|Agile: epics / sprints / backlog / rank / story-points / subtasks / velocity|Adapted from JIRA-Assistant-Skills v4.0.1|on-demand|Forked from `mk:jira-agile` skill|260510|260510
`jira-fields.md`|Domain|Custom field discovery + agile field configuration|Adapted from JIRA-Assistant-Skills v4.0.1|on-demand|Forked from `mk:jira-fields` skill|260510|260510
`jira-bulk.md`|Domain|Bulk JIRA ops (10+ issues) — dry-run mandatory first|Adapted from JIRA-Assistant-Skills v4.0.1|on-demand|Forked from `mk:jira-bulk` skill|260510|260510
`jira-jsm.md`|Domain|Service Management: queues, SLAs, customers, requests, approvals (8 sub-domains)|Adapted from JIRA-Assistant-Skills v4.0.1|on-demand|Forked from `mk:jira-jsm` skill|260510|260510
`jira-admin.md`|Domain|Project / user / group / scheme / automation administration (11 sub-domains)|Adapted from JIRA-Assistant-Skills v4.0.1|on-demand|Forked from `mk:jira-admin` skill|260510|260510
`jira-dev.md`|Domain|Dev artifacts: branch-name, PR-description, parse-commits, link-commit/PR|Adapted from JIRA-Assistant-Skills v4.0.1|on-demand|Forked from `mk:jira-dev` skill|260510|260510
`jira-ops.md`|Domain|Diagnostic: cache-status / cache-clear / discover-project|Adapted from JIRA-Assistant-Skills v4.0.1|on-demand|Forked from `mk:jira-ops` skill|260510|260510
`jira-evaluator.md`|Intelligence|Ticket complexity + inconsistency analysis (read-only)|Adapted from the toolkit jira/agents/ (skill-scoped → project-scoped, MCP→jira-as)|on-demand|Forked from `mk:jira-evaluator` skill|260510|260510
`jira-estimator.md`|Intelligence|Heuristic story-point estimation (read-only)|Adapted from the toolkit jira/agents/|on-demand|Forked from `mk:jira-estimator` skill|260510|260510
`jira-analyst.md`|Intelligence|Full ticket context analysis incl. media (read-only)|Adapted from the toolkit jira/agents/|on-demand|Forked from `mk:jira-analyst` skill|260510|260510
`story-sizer.md`|Intelligence|Pre-ticket Fibonacci sizing of paste-mode user stories. Read-only at Jira; auto-create delegates to `mk:jira-issue` + `mk:jira-collaborate`.|New in v2.9.0|on-demand|Forked from `mk:story-sizer` skill|260511|260511
```

**CE version**: Context Engineering version — tracks when agents were last improved with context engineering principles.

## Context Engineering Sections

Every agent now includes these sections (where applicable):

```toon
[3]{section,purpose,principle,present_in}
Required Context|What to load before invoking|CW3 — just-in-time context|All 17 agents
Failure Behavior|What to do when task cannot complete|AI4 — explicit failure path|17 agents (pipeline + evaluator, ui-ux-designer, git-manager, project-manager)
Ambiguity Resolution|How to handle unclear inputs|AI7 — ambiguity protocol|5 HIGH-priority agents
```

## Coverage Gaps

All phases (0-6) have agent coverage.

**No unfilled role gaps.** All phases (0-6) and all operational roles have agent coverage.

## Agent Types

- **Core** — Pipeline agents that execute sequentially through phases 0-6. Each owns a distinct workflow phase.
- **Support** — Invoked on-demand by core agents or explicitly by user. Can be spawned as subagents.
- **Domain** — Domain-specific execution agents (currently: 13 jira-* domain agents). Forked from a matching `mk:<domain>-*` thin skill via `context: fork`. The skill body becomes the task brief.
- **Intelligence** — Read-only reasoning agents that produce structured analysis without state changes (currently: 3 jira-{evaluator,estimator,analyst}).

## Subagent Status Protocol (v1.1.0)

All subagents MUST end responses with structured status. See `agent-conduct.md` (A1).
