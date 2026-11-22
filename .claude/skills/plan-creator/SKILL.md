---
name: mk:plan-creator
version: 1.6.3
preamble-tier: 3
description: "Writes the multi-file plan before building. NOT for mk:planning-engine."
argument-hint: '[task description] [--fast | --hard | --deep | --parallel | --two | --product-level [--no-design] [--no-scout] | --spike --timebox <duration>] [--tdd] [--advice] OR [archive | red-team {path} | validate {path}]'
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
source: local
keywords:
  - plan-creator
  - implementation-plan
  - phase-files
  - plan-handoff
  - scope-adaptive
  - design-evidence
when_to_use: "No plan yet."
user-invocable: true
meowkit:
  portability: provider-only
  providers:
    include:
      - claude-code
  requires:
    surfaces:
      - skills
    commands:
      - Agent
      - AskUserQuestion
      - Bash
  context_cost: high
owner: lifecycle
criticality: critical
status: active
runtime: claude-code
context_cost: high
dependency_edges:
  - id: mk:agent-detector
    type: peer
  - id: mk:autobuild
    type: peer
  - id: mk:brainstorming
    type: peer
  - id: mk:cook
    type: peer
  - id: mk:figma
    type: peer
  - id: mk:fix
    type: peer
  - id: mk:scale-routing
    type: peer
  - id: mk:scout
    type: peer
  - id: mk:validate-plan
    type: peer
---

# Plan Creator

> Script paths in this skill's other files (references, steps) are relative to this skill's directory, `${CLAUDE_SKILL_DIR}`. Prefix them with `${CLAUDE_SKILL_DIR}/` before running them; do not run them from the project root.

Public surface: classify → inspect → capture missing decisions → draft → validate → present to the user. Produces plan.md overview + phase-XX detail files; execution, existing-plan audits, archive, and memory entries stay with their existing owners.

## When to Use

Activate when:

- User runs `/mk:plan-creator [task]` or `/mk:cook [task]`
- Non-trivial task (> 2 files OR > 30 min OR architectural decisions)
- User supplies ≥2 upstream reports/specs (office-hours, brainstorming, planning-engine, confluence-spec, intake output…) → step-00.5 consolidates them into a Plan Intake Packet before planning (see `references/plan-intake-packet.md`)
- User supplies a design evidence packet (e.g. from `mk:figma`) → plan consumes it (viewport/state ACs, critical-action validation matrix, phase `blocked_on:` for high-risk flow ambiguity), never re-analyzes the design source (see `references/design-evidence-consumption.md`)
- Phase 3 needs a plan to build from
- Green-field product build ("build a kanban app", "create a SaaS dashboard", "make a retro game maker") → step-00 auto-detects and offers `--product-level`
- Existing-plan audit → `mk:validate-plan`; archive → lifecycle CLI.
- Hard/deep plan creation still runs its built-in red-team and validation interview before presenting the plan. These are design-quality steps of that flow and must never be routed away; the `red-team {path}` and `validate {path}` aliases below run them standalone on an existing plan.
- Compatibility aliases: `/mk:plan-creator archive` → [archive workflow](references/archive-workflow.md); `/mk:plan-creator red-team {path}` → [standalone red-team workflow](references/red-team-standalone.md); `/mk:plan-creator validate {path}` → [standalone validation workflow](references/validate-standalone.md).

Standalone aliases route to their compatibility references; they do not replace hard/deep red-team or validation.

Skip when:

- `/mk:fix` with complexity=simple (the fix is the plan)
- `mk:scale-routing` returns workflow=one-shot + zero blast radius

## Arguments

Modes: (default) auto-detect from scope | `--fast` | `--hard` | `--deep` | `--parallel` | `--two` | `--product-level` | `--spike --timebox <duration>`. What each mode changes (research, phase files, validation) and the `--spike` constraints (timebox required, frontmatter, incompatible combinations, story-point cap): `references/modes-and-flags.md` — load it when a mode flag is present or step-00 picks a mode.

**Composable flags:**

- `--tdd` — add tests-first phase sections and preserve strict TDD in the cook handoff. See `references/tdd-mode.md`.
- `--advice` — opt-in strategic supervision; see `--advice` below.

## Requirements Capture Contract

Before producing a plan, plan-creator MUST be able to answer all 5 dimensions in concrete sentences (cook's exact-requirements contract — see `.claude/skills/cook/SKILL.md` "Exact-Requirements Contract (Phase 1)"):

1. **Expected output** — concrete artifact(s) the user will see at the end (file paths, feature behavior, UI screen, API endpoint + payload, CLI command + flags).
2. **Acceptance criteria** — specific behaviors / inputs → outputs / edge cases that MUST work to call it "done".
3. **Scope boundary** — what is explicitly OUT of scope this round.
4. **Non-negotiable constraints** — stack, file locations, naming, backward compatibility, deadlines, performance.
5. **Touchpoints** — which existing files/modules (from scout) will be modified or extended; which contracts must stay stable.

Every clarifying question MUST cite scout findings (file paths) in its options. Abstract options like "Add the feature" without a file path are a failure mode — replace with options of the form "Add to `src/api/users.ts` (matches existing pattern)" or "Create new `src/api/profile.ts`".

Skip when input is an existing plan path (`plan.md` / `phase-*.md`) — the plan already encodes scout output and the 5 dimensions.

## Workflow

Before starting, read `references/failure-catalog.md` for common planning failure modes to avoid.

Execute via `workflow.md`. Step-file architecture — load one step at a time.
Fast mode (`--fast`) uses `workflow-fast.md` (steps 00→03→04→07→08).

**Agile DoR advisory (Phase 1 entry, conditional):** if the parsed plan frontmatter contains a non-empty `jira_tickets:` list AND `agile-story-gates.md` is loaded (Agile context active per `mk:agent-detector` Step 0b), run 1 of `agile-story-gates.md` for each ticket BEFORE generating phase files. Render the advisory checklist; never block — let the user decide. Skip silently when `jira_tickets:` is absent or the rule is not loaded.

```
Step 0: Scope Challenge → TRIVIAL (exit) | STANDARD (fast) | COMPLEX (hard/deep)
Step 0.5: Intake Packet (conditional: ≥2 external artifacts) → consolidate upstream artifacts, else clean skip
Step 1: Research (hard/deep/parallel/two only) → 2-3 researchers, max 5 calls each
Step 2: Codebase Analysis (hard/deep/parallel/two only) → scout + docs (deep: bounded scope map)
Step 3: Draft Plan → plan.md (≤80 lines) + phase-XX files (12-section template; deep: + phase map; tdd: + regression sections)
Step 4: Semantic Checks → goal/ACs/constraints + structural validation
Step 5: Red Team (hard/deep/parallel/two only) → 4-persona scaling, red-team-findings.md, adjudication
Step 6: Validation Interview (hard/deep/parallel/two only) → 3-5 critical questions with detection keywords, propagate answers
Step 7: Present plan → self-check + ask the user (Looks right | Modify | Reject)
Step 8: Hydrate Tasks → phase checkboxes → session tasks
Step 9: Post-Plan Handoff → mode-pruned ask the user (cook|validate|red-team|end) → write `handoff.next` to plan.md → STOP
```

## Output Structure

**Fast mode:** Single `plan.md` (goal, context, scope, approach, ACs)
**Hard mode:** Directory with plan.md + phase files:

```
tasks/plans/YYMMDD-name/
├── plan.md              ← overview (≤80 lines)
├── research/            ← researcher reports (hard mode)
├── phase-01-name.md     ← 12-section detail (≤150 lines)
├── phase-02-name.md
└── ...
```

## Gotchas

- **Wrong workflow model**: feature-model on a bug fix skips investigation → confirm type at Step 0
- **Goal describes activity**: "Implement OAuth" vs "Users can log in with OAuth" → rewrite as outcome
- **ACs can't be verified**: "code is clean" gives the reviewer nothing to check → every AC must reference a command/file check
- **Monolithic plan**: plan.md over 80 lines → move detail to phase files or research reports
- **Research disconnected**: findings archived but not cited in plan → Step 3 MUST integrate research into Key Insights
- **Over-planning trivial tasks**: 2-file config change gets full research → Step 0 scope check exits early
- **Skipping scout on unfamiliar codebases**: → always run mk:scout if codebase is new
- **Using `--deep` to decide architecture**: deep maps a chosen approach; if the approach is unclear, route to `mk:brainstorming` first.
- **Dropping TDD at handoff**: when `tdd_mode=true`, step-09 MUST print cook with `--tdd`; sentinel/env state alone is not a cross-session contract.
- **Post-Plan Handoff is deterministic**: step-09 asks the user; do NOT auto-invoke the chosen command. User must type it in a fresh session for clean context.
- **`handoff.next` enum is validated**: values outside `{cook, validate, red-team, autobuild, end}` fail the structural check.
- **Whole-Plan Consistency Sweeps W1 / W2 fire after red-team and validation interview**: stage-then-apply algorithm — no edits land until the user resolves any unresolved contradictions. See `references/whole-plan-sweep.md`.
- **`consistency_sweeps` frontmatter is optional**: legacy plans without it still validate as `PLAN_COMPLETE`.
- **Sweep recursion is bounded**: "resolve now" caps at 2 attempts per sweep; further unresolved items convert to Risk rows.
- **`.plan-state.json` v1.2 schema is additive**: consumers MUST treat unknown keys (`verification_tier`, `consistency_sweeps_passed`) as optional and default-empty. v1.1 readers ignore them silently.
- **Post-hydration integrity-check failure is a hard stop**: cycle / count-mismatch / missing-metadata failures print an explicit diff and STOP — do NOT auto-recover or silently continue. Human resolution required before step-09. See `references/task-management.md` "Post-Hydration Integrity Checks".
- **Re-analyzing a design source that already has a packet duplicates interpretation**: when a design evidence packet path is present, cite the packet — do NOT call the design source's tools or re-parse its raw JSON. See `references/design-evidence-consumption.md`.

## `--advice` (composable, off by default)

Opt-in strategic supervision for one planning run, capped at 4 calls: GUIDE after the
scope challenge, RESCUE on an unresolved red-team contradiction, REVIEW before the plan is agreed
step, RECHECK after a correction.

Athena reads the plan and can return it to the planner. It never writes the plan and never
settles it with the user.

Without the flag there are zero calls and no state is written.

Checkpoints: `references/advice-checkpoints.md`. Contract: `.claude/skills/advise/references/advice-supervision-rules.md` (load only when the
flag is present).

## Related Rules

- `.claude/rules/meowkit-core.md` — planning as a practice: write the plan and agree it with the user before Phase 3
- `.claude/skills/cook/references/orchestration-rules.md` — boundary contract; verification subagents stay READ-ONLY; sweep stays in planner context (never delegated)
- `.claude/skills/cook/references/task-state-emission.md` — when an active durable task record exists, emit status/step via `mewkit task-state update` (advisory; active durable tasks only)

## File Index

Every step file, template, persona prompt, script and reference this skill ships, with its purpose, plus the documented filename exception for the few-shot calibration example: `references/file-index.md` — load it when you need a file no step names, such as the metrics design guide, the plan mutation protocol, the ADR guide or a worked example.

## Start

Read and follow `workflow.md`.
