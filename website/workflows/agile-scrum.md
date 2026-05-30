---
title: Agile / Scrum Workflow
description: Sprint goal, DoR/DoD, retro→action loop, and spike governance via the Agile conditional rule layer.
persona: B
---

# Agile / Scrum Workflow

> Lightweight Agile/Scrum governance that loads only when an Agile context is detected. Non-Agile sessions pay zero context cost.

**Best for:** Teams running Jira-tracked sprints with the toolkit
**Time estimate:** Per-sprint ceremonies; no setup beyond opt-in frontmatter
**Skills used:** [mk:plan-creator](/reference/skills/plan-creator), [mk:sprint-contract](/reference/skills/sprint-contract), [mk:retro](/reference/skills/retro), [mk:jira-agile](/reference/skills/jira-agile), [mk:ship](/reference/skills/ship), [mk:agent-detector](/reference/skills/agent-detector)
**Rules:** `agile-story-gates.md`, `agile-sprint-commitment.md`, `agile-feedback-cycle.md` (in `.claude/rules-conditional/`)

## Overview

The toolkit ships a thin Agile governance layer covering:

- **Definition of Ready (DoR)** — Phase 1 entry advisory: AC text, estimate, sprint linkage, recent evaluator report, no open blockers
- **Definition of Done (DoD)** — Gate 2 PASS extension: post verdict to Jira, transition status, business AC checkbox
- **Sprint goal persistence** — file-based contract surviving across sessions
- **Mid-sprint amendment ceremony** — log scope changes transparently, never silently
- **Sprint close hygiene** — disposition prompt for non-terminal commits + closure summary
- **Retro action-item ceremony** — surfaced retro insights become tracked work or documented "no action" decisions
- **Spike governance** — time-boxed investigations with findings doc; INCOMPATIBLE with `mk:autobuild` FULL

No new agents, no new hooks, no new gates. Wires into existing skills.

## Activation

The 3 Agile rules load via `mk:agent-detector` Step 0b ONLY when an Agile context is detected. **OR-logic — any one match triggers load:**

| Trigger | Detection |
|---------|-----------|
| Sprint-state contract present | Glob `tasks/contracts/sprint-state-*-sprint-*.md` returns ≥1 result |
| Plan frontmatter | `jira_tickets:` non-empty in active plan |
| Env var | `MEOW_JIRA_BASE_URL` set |
| User prompt | Last user message matches `[A-Z]{2,10}-\d+` |

A pre-flight check verifies the `.claude/rules-conditional/` directory exists; if absent, the load is skipped silently.

## Sprint Setup

### Step 1: Create the sprint-state contract

```bash
/mk:sprint-contract sprint-goal set "Reduce p99 checkout latency below 800ms" --sprint 42
```

Writes to `tasks/contracts/sprint-state-{YYMMDD}-sprint-42.md`:

```yaml
---
sprint_id: 42
sprint_goal: "Reduce p99 checkout latency below 800ms"
start_date: 2026-05-13
end_date: 2026-05-27
committed_tickets: []
amendments: []
status: active
---
```

### Step 2: Create plans with Jira traceability

In your `tasks/plans/{slug}/plan.md` frontmatter:

```yaml
jira_tickets: [PROJ-123, PROJ-124]
sprint_id: 42
```

Now `mk:plan-creator` will run the DoR advisory at Phase 1 entry, and `mk:ship` will surface DoD prompts at Gate 2 PASS.

## Per-Sprint Ceremonies

### Definition of Ready (Phase 1 entry)

When you run `/mk:plan` on a plan that has `jira_tickets:`, the DoR advisory checks each ticket:

1. AC text present
2. Non-zero story-point estimate
3. Sprint linkage if `sprint_id:` is present
4. Recent (≤14d) `mk:jira-evaluator` report
5. No open `is blocked by` link to a non-Done ticket

Output is advisory only — never blocks. Surface gaps; you decide.

### Mid-sprint scope change

```bash
/mk:jira-agile sprint add PROJ-125 --sprint 42
```

If the sprint is already active, the skill:

1. Acquires `flock` on the sprint-state file (concurrent-write safety)
2. Prompts: "Reason for mid-sprint scope change?" — required free-text
3. Appends `{ ts, action: add, ticket: PROJ-125, reason }` to `amendments:`
4. Releases the lock and proceeds with the underlying Jira call

The append IS the commitment. No re-sign ceremony for non-harness work.

### Definition of Done (Gate 2 PASS)

When `/mk:ship` runs and the verdict has non-empty `jira_tickets:`, three opt-in actions surface:

1. **Verdict→Jira comment.** "Post the Gate 2 verdict to PROJ-123 as a comment? [Y/n/edit]"
2. **Status transition.** "Transition PROJ-123 to Done? [Y/n/skip]"
3. **Business AC checkbox.** Source priority: (a) Jira AC field; (b) **fallback to plan.md `## Acceptance Criteria`** if Jira read fails

Each is cancel-safe. Each has a Jira-offline fallback (`posted_to_jira: deferred`, `transitioned_to_done: deferred`).

For non-Agile sessions (verdict has no `jira_tickets:`), the entire DoD block is skipped via early-return guard. ONE frontmatter read; effectively zero added cost.

### Sprint close

```bash
/mk:jira-agile sprint close --sprint 42
```

The skill:

1. Reads `committed_tickets:` from the sprint-state contract
2. Queries each ticket's status via `mk:jira-issue get`
3. For each non-terminal ticket: "PROJ-X is in {status}. Carry over? Drop? Mark not delivered?"
4. Writes closure summary: `status: closed`, `closed_at`, `delivered: [...]`, `carried_over: [...]`

### Retrospective with action-item ceremony

```bash
/mk:retro
```

After the narrative is written, when an Agile context is active, `mk:retro` parses `## 3 Things to Improve` and `## 3 Habits for Next Week` and surfaces a per-item AskUserQuestion:

| Option | Effect |
|--------|--------|
| Create Jira story now | `mk:jira-issue create` body pre-filled — REQUIRES user review |
| Add to plan TODO | Append to active plan |
| Document as no-action | Append to `.claude/memory/retros/{date}-decisions.md` with reason |
| Defer to next retro | Carry forward |

The retro is not "complete" until every action has a disposition.

### Spikes (time-boxed investigation)

```bash
/mk:plan-creator --spike --timebox 2d "Investigate JWT refresh strategy options"
```

Generates a two-phase plan from `mk:plan-creator/assets/spike-plan-template.md`:

- **Phase 1 — Investigate** (within timebox)
- **Phase 2 — Document Findings** (≤25% of timebox)

Frontmatter includes `spike: true`, `timebox: "2d"`, `findings_doc:`. NO test phase, NO ship phase.

::: warning Harness incompatibility
Spike plans are INCOMPATIBLE with `mk:autobuild` FULL density mode. Harness FULL requires Phase 2 (test red) → Phase 3 (build green) → Phase 4 (review) sequence with a sprint-contract gate. Spikes skip Phase 2/Phase 5; the harness flow breaks. Run via `mk:cook` or `mk:plan-creator --fast`.
:::

At spike completion: "Convert findings to delivery story? [Yes — extract AC | No — research-only | Defer]"

## Architecture

- **Plan-as-source-of-truth** retained — Jira receives projections only (verdict comment, status transition); never authoritative
- **Reports-not-automation** preserved — every action surfaces a prompt; no silent ticket creation
- **Sprint-state contracts** at `tasks/contracts/sprint-state-{date}-sprint-{N}.md` — distinct from per-story sprint-CONTRACT files. Leading `sprint-state-` prefix prevents glob collision with the existing contract validator
- **Concurrent-write safety** — writers acquire `flock` before any read-modify-write cycle on sprint-state files; YAML frontmatter append is non-atomic across shells
- **Validator scope** — `validate-contract.sh` validates per-story sprint-CONTRACT files only; sprint-STATE files have NO validator (YAML parsed inline by consuming skills)

## Out of Scope

The following are deliberately NOT covered by this rule layer:

- WIP limits (team policy concern)
- Async standup cadence (needs cron)
- PO acceptance ceremony (human social)
- Velocity hygiene (skill-level concern)
- Bidirectional Jira sync (Jira is projection-only)

## See Also

- [Sprint Retrospective](/workflows/retrospective) — `mk:retro` deep dive
- [Spec to Sprint Planning](/workflows/spec-to-sprint) — upstream planning workflow
- [Ticket Evaluation & Estimation](/workflows/ticket-evaluation) — DoR readiness checks per ticket
- [Rules Index](/reference/rules-index) — full rule catalog
