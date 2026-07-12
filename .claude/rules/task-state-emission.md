# Task-State Emission Rules

[CONTEXTUAL] — applies only while an orchestration workflow (plan → cook → review, or a
selected long-running flow) is driving an **active durable task**. Loaded on demand by those
skills; it costs zero always-on context otherwise.

Durable task state is the append-target for resume + capability audit. These rules say when a
workflow emits an event, and — equally important — when it must NOT, so one-off work never
pollutes the record.

## Rule 1: Emit Only For An Active Durable Task

Emit task-state events ONLY when an active durable task record exists (a
`tasks/active/<id>.json`, typically created for planned/long-running work). One-off edits,
trivial fixes, and ad-hoc questions record NOTHING — there is no record to update, and
inventing one is noise.

WHY: The record is a resume + audit surface for real tasks, not a log of every action.

## Rule 2: What To Emit

At meaningful workflow boundaries, update the record via the CLI:

- **Status / step** at phase transitions:
  `mewkit task-state update <id> --status <active|blocked|done> --step "<what just finished>" --next "<next action>"`
- **A capability decision** whenever a `mewkit capabilities resolve` outcome is acted on. Record
  the decision as one of `selected | skipped | unavailable | unsupported`, the reason, and the
  availability snapshot id — so a later session can audit why a capability was or wasn't used.

Plans remain the human source of truth; the record JOINS a plan by path, never replaces it.

## Rule 3: Advisory, Best-Effort, Never Blocking

Emission is advisory. A failed write is surfaced (the CLI exits non-zero) but MUST NOT block
the workflow — there is no Stop-gate on task-state. If the installed `mewkit` CLI does not
provide `task-state` (an older consumer CLI predating this command), skip silently: treat the
missing command as "no durable record this run", not as a task failure.

WHY: The harness is an outer layer; it records what it can and degrades gracefully. A durable
ledger must never become a reason a real task cannot proceed.

## Rule 4: Never Fabricate

Record only what is true: real repository identities and revisions or a folder contains multiple repositories (null revision for non-git
roots — never invent one), real verification results, real capability decisions. A record write
that cannot be confirmed is reported honestly, not asserted as done.

WHY: A durable audit surface is worse than useless if it contains fabricated state.

## Applies To

- `mk:cook` (single-task pipeline), `mk:plan-creator`, `mk:review`, and selected long-running
  workflows that drive an active durable task.
- The `npx mewkit task-state` CLI is the one compatible surface; record compatibility is governed by
  the record's `schemaVersion` (the CLI refuses to read/overwrite an incompatible record).
