---
title: "mk:plan-creator"
description: "Creates structured multi-file implementation plans before any code is written — scope detection, research, codebase analysis, semantic checks, red-teaming, validation interview."
---

# mk:plan-creator

## What This Skill Does

The planning engine. Creates a complete implementation plan before any code is written. Uses a step-file architecture (one step loaded at a time to save context) with 10 phases: scope challenge → research → codebase analysis → draft → semantic checks → red-team → validation interview → Gate 1 → hydrate.

## When to Use

- **Gate 1 requirement:** any non-trivial task (>2 files or >30 min) REQUIRES an approved plan before code
- **Explicit invocation:** `/mk:plan` or called by `mk:cook` / `mk:workflow-orchestrator`
- **NOT for:** trivial single-file changes, quick fixes with `--quick` flag, tasks that have an existing approved plan

## Core Capabilities

- **Scope detection:** auto-detects product-level intent via regex patterns (feature requests, greenfield builds, spec documents) and presents scope mode (EXPANSION / HOLD / REDUCTION)
- **Complexity routing:** 5 signals determine scope depth — file count, domain keywords, cross-cutting concerns, security surface, data model changes
- **Step-file loading:** 10 sequential step files loaded one at a time, each producing checkpointed output
- **Research spawning:** up to 2 researcher agents with max 5 calls and ≤150 lines of context each
- **Codebase analysis:** scout + project docs + existing plan scan for cross-plan dependency detection
- **Two-approach mode:** for COMPLEX tasks, produces two alternative approaches with trade-off analysis
- **Semantic checks:** validates plan against 6 dimensions (goal clarity, AC completeness, constraint realism, risk coverage, line count, product-level specifics)
- **Red-teaming:** 4 adversarial personas selected by phase count, subagent-dispatched with anti-sycophancy IGNORE instruction
- **Validation interview:** 5 question categories with detection keywords, 2-4 options each, recommended option marked
- **Bead decomposition:** for tasks with 5+ files, breaks into atomic work units with dependency chains (beads → strands → ropes)
- **Hydration:** creates TaskCreate entries with dependency chains, parallelism groups, `.plan-state.json` checkpoint

## Requirements Capture Contract

Before producing a plan, plan-creator MUST answer all 5 dimensions in concrete sentences (cook's exact-requirements contract — see `.claude/skills/cook/SKILL.md` "Exact-Requirements Contract (Phase 1)"):

1. **Expected output** — concrete artifact(s) the user will see at the end (file paths, feature behavior, UI screen, API endpoint + payload, CLI command + flags).
2. **Acceptance criteria** — specific behaviors / inputs → outputs / edge cases that MUST work to call it "done".
3. **Scope boundary** — what is explicitly OUT of scope this round.
4. **Non-negotiable constraints** — stack, file locations, naming, backward compatibility, deadlines, performance.
5. **Touchpoints** — which existing files/modules (from scout) will be modified or extended; which contracts must stay stable.

Every clarifying question MUST cite scout findings (file paths). Abstract options ("Add the feature") without a file path are a failure mode — replace with options of the form "Add to `src/api/users.ts` (matches existing pattern)" or "Create new `src/api/profile.ts`".

Skip when input is an existing plan path (`plan.md` / `phase-*.md`) — the plan already encodes scout output and the 5 dimensions.

## Arguments

| Flag | Effect |
|------|--------|
| `--feature` | Feature implementation plan (default) |
| `--bugfix` | Bug fix plan |
| `--refactor` | Refactoring plan |
| `--security` | Security-focused plan |
| `--product-level` | Product-level spec with design language, LIGHT scout with allowlist/blocklist |
| `--deep` | Deep mode — per-phase scouting, full analysis |
| `--tdd` | TDD mode — adds 4 TDD-specific phase sections |
| `--parallel` | Parallel agent mode with ownership matrix |
| `--two-approach` | Two-alternative design with trade-off comparison |
| `--no-design` | Skip design language subagent (product-level only) |
| `--no-scout` | Skip codebase scout (product-level only) |
| `--spike --timebox <duration>` | Time-boxed investigation (Agile mode). Skips research, codebase analysis, red-team, validation interview. Uses `assets/spike-plan-template.md` (investigate + findings, no test/ship). Incompatible with `--product-level` and `mk:harness` FULL |

### Spike mode (Agile context)

Governed by `.claude/rules-conditional/agile-feedback-cycle.md` Section 2 (loaded only when Agile context active).

- Requires `--timebox <duration>` (e.g., `--timebox 2d`, `--timebox 4h`); rejected without it
- Sets plan frontmatter `spike: true`, `timebox:`, `findings_doc:` (default `tasks/plans/{slug}/findings.md`)
- Two phases only: investigate + document findings — NO test phase, NO ship phase
- Story-points cap (advisory): warn if `story_points > 5`
- INCOMPATIBLE with `mk:harness` FULL density (harness gate breaks); use `mk:cook` or `mk:plan-creator --fast`
- At spike completion: prompt to convert findings to delivery story / close as research-only / defer

### DoR advisory at Phase 1 entry (Agile context)

If the plan frontmatter has non-empty `jira_tickets:`, `mk:plan-creator` runs the DoR advisory checklist (5 mechanical checks per ticket) BEFORE generating phase files. Advisory only — never blocks. Skip silently when `jira_tickets:` absent or rule not loaded. Governed by `agile-story-gates.md` Section 1.

## Workflow (10 step files)

| Step | Name | Key Output |
|------|------|-----------|
| 00 | Scope challenge | Planning mode, workflow model, scope mode, complexity tier |
| 01 | Research | Researcher reports with source citations |
| 02 | Codebase analysis | Scout findings, existing plan scan, cross-plan dependencies |
| 03 | Draft (feature) / 03a (product-level) | plan.md with 12-section phase template + YAML frontmatter |
| 04 | Semantic checks | Validation report, two-approach selection (if applicable), Verification Roles dispatch (sub-step 4d — Light/Standard/Full tier by phase count) writes `## Verification Log` per phase file |
| 05 | Red-team | 4-persona adversarial analysis, red-team-findings.md (7-field findings); Gate W1 Whole-Plan Consistency Sweep at exit |
| 06 | Validation interview | 5-category questions with propagated answers; Gate W2 Whole-Plan Consistency Sweep at exit |
| 07 | Gate 1 | Self-check (Completed/Skipped/Uncertain), AskUserQuestion, memory capture |
| 08 | Hydrate | TaskCreate with dependency chains, critical-step sub-tasks, `.plan-state.json` (v1.2) |
| 09 | Post-plan handoff | Mode-pruned AskUserQuestion (cook / validate / red-team / harness / end), writes `handoff: { next, decided_at }` to plan.md frontmatter, prints command, STOPs |

**Branching:** product-level mode uses step-03a instead of step-03. Fast mode and product-level mode skip steps 05-06 and the 4d Verification Roles sub-step.

**Gates W1 / W2** stage edits before applying (read-only Pass 1 stages `### Pending Sweep Edits`; decision check blocks on unresolved contradictions via AskUserQuestion; Pass 2 applies and logs). Algorithm: `references/whole-plan-sweep.md`. Verification Roles algorithm + dispatch brief: `references/verification-roles.md`.

## Usage

```bash
/mk:plan "add two-factor authentication to login"
/mk:plan --product-level "build a kanban board app"
/mk:plan --bugfix "fix race condition in payment processing"
/mk:plan --deep --two-approach "migrate from REST to GraphQL"
/mk:plan --tdd "implement rate limiting middleware"
```

## Example Prompt

```
Plan the implementation of real-time collaborative editing for our document editor. Support up to 50 concurrent editors, operational transform for conflict resolution, and WebSocket-based sync. Must work with existing React frontend and Node.js backend.
```

## Common Use Cases

- Feature implementation planning (most common)
- Greenfield product builds (product-level mode)
- Bug fix planning for complex issues (multi-file, race conditions)
- Architecture migration planning (two-approach mode useful)
- Security-focused planning with TDD enforcement
- Multi-agent parallel build planning (bead decomposition + ownership matrix)

## Pro Tips

- **Product-level mode auto-detects.** The regex patterns catch phrases like "build a", "create an app", "from scratch" — you rarely need the `--product-level` flag explicitly.
- **Step-05 and 06 are skipped in fast mode.** If you need adversarial review, don't use fast mode.
- **Plan state persists.** `.plan-state.json` enables resumption if context is lost mid-planning.
- **CEO review after Gate 1.** Consider running `mk:plan-ceo-review` on the approved plan for an additional quality layer.
- **Variables flow between steps.** 10 variables (planning_mode, task_complexity, workflow_model, scope_mode, research_reports, codebase_findings, plan_dir, red_team_findings, selected_approach, tdd_mode) pass between step files.

> **Canonical source:** `.claude/skills/plan-creator/SKILL.md`
