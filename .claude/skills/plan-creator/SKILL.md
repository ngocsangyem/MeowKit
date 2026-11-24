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
  - id: mk:office-hours
    type: peer
  - id: mk:plan-ceo-review
    type: peer
  - id: mk:scale-routing
    type: peer
  - id: mk:scout
    type: peer
  - id: mk:validate-plan
    type: peer
---

# Plan Creator

Turns a task into a plan the executor can build from: `plan.md` (at most 80 lines) plus, for larger work, one `phase-XX-*.md` per phase, under `tasks/plans/YYMMDD-slug/`. Use it when there is no plan yet and the task touches more than 2 files, takes more than 30 minutes or involves an architectural decision. Skip it when `mk:scale-routing` says one-shot with no blast radius, or `/mk:fix` handles a simple bug (the fix is the plan). Script paths in this skill's files are relative to `${CLAUDE_SKILL_DIR}`.

## What a plan must answer

Before drafting, be able to answer these in concrete sentences (the same contract `mk:cook` checks; skip it when the input is already a plan path):

1. **Expected output**: the artifacts the user will see (file paths, behaviour, endpoint and payload, command and flags).
2. **Acceptance criteria**: inputs, outputs and edge cases that must work; each checkable by a command or file check.
3. **Scope boundary**: what is out this round.
4. **Constraints**: stack, locations, naming, compatibility, deadlines, performance.
5. **Touchpoints**: the existing files and contracts the work touches, from scout.

Cite a scout file path in every clarifying question's options ("Add to `src/api/users.ts`, which matches the existing pattern"); an option like "add the feature" gives the user nothing to decide.

## Where to go

| Request | Route |
|---|---|
| Plan a task | `workflow.md` |
| `--fast`, `--hard`, `--deep`, `--parallel`, `--two`, `--product-level`, `--spike --timebox <d>`, `--tdd`, `--advice` | `workflow.md` mode matrix; `references/modes-and-flags.md` |
| `red-team {path}`: attack an existing plan with reviewers, then apply fixes | `references/red-team-standalone.md` |
| `validate {path}`: ask the plan's open decisions, write the answers in | `references/validate-standalone.md` |
| `archive` | `references/archive-workflow.md` |
| Is the agreed plan complete and executable? (report only) | `mk:validate-plan` |
| Is the scope ambitious or right-sized? | `mk:plan-ceo-review` |
| Should this exist at all? | `mk:office-hours` |
| Two approaches or an open trade-off | `mk:brainstorming` first |

Hard-family plans run their own red team and interview before presenting; the `red-team` and `validate` aliases run them again on an existing plan.

## The plan file

`mewkit plan check --structural` enforces `## Goal`, the frontmatter fields title, type, status and priority, an optional `handoff.next` in `cook | validate | red-team | autobuild | end`, and the phase-file shape (`references/phase-template.md`). The rest, such as the quality of goals and criteria, is judgment, checked in step 4. Phase files are at contract level; file-level detail only when the executor needs it.

With an agile ticket list in the plan frontmatter (`jira_tickets:`) and `agile-story-gates.md` loaded, show its definition-of-ready checklist per ticket before drafting phases; advisory, never blocking.

## `--advice` (off by default)

With the flag, a supervisor reads the plan at four named points (after the scope challenge, on an unresolved red-team contradiction, before the plan is presented, after a correction), at most four calls per run. It may send the plan back to the planner; it never writes the plan or settles it with the user. Without the flag nothing is called and no state is written. Checkpoints: `references/advice-checkpoints.md`; the call contract, loaded only with the flag: `.claude/skills/advise/references/advice-supervision-rules.md`.

## Optional guides

| When | Load |
|---|---|
| The task is about metrics, KPIs or dashboards | `references/ops-metrics-design.md` |
| A plan records an architectural decision | `references/adr-generation.md` |
| An existing plan needs a split, insert, skip, reorder or abandon | `references/plan-mutation-protocol.md` |
| Two or more upstream reports feed the plan | `references/plan-intake-packet.md` |
| A design evidence packet (for example from `mk:figma`) is present | `references/design-evidence-consumption.md` |
| Writing phase files an executor reads cold | `references/cold-start-context-brief.md` |

`references/file-index.md` lists every shipped file.

## Exits

- Trivial task: send it to `/mk:fix` or a direct edit.
- Approach and touchpoints both unclear: ask for scout or brainstorm; do not draft phases.
- Red team or interview show the approach cannot meet the goal: stop and tell the user what you found instead of patching around it.

## Gotchas

- Goal as activity ("Implement OAuth") instead of outcome ("Users can log in with OAuth"): rewrite it.
- Acceptance criteria nobody can verify ("code is clean"): tie each to a command or file check.
- A monolithic `plan.md` over 80 lines: move detail into phase files.
- Research that is archived but not cited: step 3 must pull it into Key Insights.
- Planning a trivial task with full research: step 0 exits early.
- Skipping scout on an unfamiliar codebase: scout first.
- Using `--deep` to decide an architecture: it maps a chosen approach, so an unclear one goes to `mk:brainstorming`.
- Dropping `--tdd` at handoff: step 9 prints cook with `--tdd` because a state file will not survive a new session.
- Auto-running the chosen command at step 9: the user types it in a fresh session.
- `handoff.next` outside the enum fails the structural check.
- A failed post-hydration integrity check is a hard stop for a human to resolve; do not recover silently.
- Re-analysing a design source that already has an evidence packet duplicates interpretation: cite the packet.
- `.plan-state.json` is a cache that `mewkit plan sync` updates only when it exists; do not write it by hand.

## Related

`.claude/rules/meowkit-core.md` (plan, then agree with the user, before building); `.claude/skills/cook/references/orchestration-rules.md` (verification subagents stay read-only; the sweep stays in your context); `.claude/skills/cook/references/task-state-emission.md` (status updates when a durable task record exists).

Start with `workflow.md`.
