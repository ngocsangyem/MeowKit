# Internal Runtime

`runtime: internal` dispatches a job through the current harness's in-session
subagent mechanism instead of spawning a CLI process. This file owns internal
dispatch, capture, timeout, and resume mechanics. It does not own route
selection; apply [model-routing.md](model-routing.md) to the live internal
profile and any CLI fallbacks.

Internal dispatch is useful when the current session exposes a qualified
specialist and subprocess startup would add little value. It is not a sandbox:
agents inherit the session's permission posture unless the live harness proves
stronger enforcement.

## Contents

- [Live Discovery](#live-discovery)
- [Resolution Handoff](#resolution-handoff)
- [Dispatch Contract](#dispatch-contract)
- [Tool Boundaries](#tool-boundaries)
- [Capture Mapping](#capture-mapping)
- [Model Ownership](#model-ownership)
- [Timeout](#timeout)
- [Resume](#resume)
- [Boundaries](#boundaries)

## Live Discovery

Record internal availability in `<run-dir>/runtimes.json` during preflight:

1. Query the current harness for the agent types it can dispatch.
2. Capture each available agent's live name, description, declared tools,
   permission boundary, and model metadata when exposed.
3. Use project or user agent-definition files only as supporting evidence when
   the live list is unavailable; on-disk presence does not prove session
   availability.
4. Record unknown fields as unverified. Never assume a familiar agent name is
   installed or unchanged.

Do not maintain a copied agent roster here. Installed kits and harness
versions change the available set, and different runtimes expose it through
different mechanisms — an in-session agent list from the active runtime, or
an on-disk agent-definition directory (e.g. `.codex/agents/`) another
installed runtime reads instead. Any runtime named here is an example of an
installed runtime to discover, never a fixed catalog.

When the current toolkit session exposes its own roster (planner, architect,
brainstormer, researcher, developer, tester, reviewer, evaluator, security,
documenter, journal-writer, analyst, project-manager, git-manager, shipper,
ui-ux-designer), treat that list the same way: illustrative of what a session
*may* expose, resolved fresh every run, never assumed from a prior report.

## Resolution Handoff

Apply the **Internal Branch** in
[model-routing.md](model-routing.md) to the live profile. That section alone
owns explicit-agent validation, description-based matching, general-purpose
fallback, model-independence handling, and the decision to use a CLI fallback
or block.

This file receives the resolved agent and records it, plus any substitution,
in `status.json`. It must not add task-to-agent defaults or concrete model
fallbacks.

## Dispatch Contract

Dispatch one subagent per job. The prompt must include:

- task and expected output;
- exact `cwd`, plus worktree path when isolated;
- files the agent may read and write;
- relevant skill path and instruction files;
- risk limits, including forbidden external or destructive actions;
- listed checks the agent may run;
- `DO NOT COMMIT OR PUSH` unless the coordinator explicitly assigned that
  authority;
- instruction to return the deliverable as the final message.

Build this prompt with `mk:delegate` rather than composing it ad hoc — it
assembles the task, file ownership, and acceptance-criteria fields the
dispatch contract requires and keeps the shape consistent with every other
in-session delegation.

Independent same-stage jobs may launch together up to `concurrency`, capped at
3 concurrent internal agents per `parallel-execution-rules.md` regardless of
what the spec requests — a ceiling that applies only to internal dispatch, not
to external CLI runtimes. Parallel writing jobs require disjoint ownership and
separate worktrees, created via `mk:worktree`. The prompt pins the agent to
its worktree, but that remains prompt-level isolation; never treat it as an OS
sandbox.

Internal jobs must not perform `destructive: true` or credentialed external
actions unless the live harness supplies controls that satisfy the R3 policy
and the human approval recorded per `intervention-recording-rules.md` and
`gate-rules.md` is already in hand. When it does not, route to a qualified
externally isolated candidate or block.

## Tool Boundaries

- Agent-definition tool restrictions are enforceable only to the extent the
  current harness proves them.
- Job `allowed_tools` and `disallowed_tools` are advisory prompt constraints
  unless the harness exposes per-job enforcement.
- Record whether shell, write, network, and external-tool access can be denied
  independently.
- Do not infer least privilege from a specialist name or description.

If a job needs a control the current internal harness cannot enforce, the
internal candidate does not meet that risk tier.

## Capture Mapping

Internal jobs have no subprocess surface. Map the normal capture contract as
follows:

| CLI capture | Internal equivalent |
| --- | --- |
| `stdout.txt` | `result.md`, containing the subagent's final text |
| `stderr.txt` | none; harness errors go in `status.json.error` |
| `command.txt` | none; `status.json.agent` records dispatch identity |
| exit code | `null`; `status` records success, failed, blocked, or interrupted |

Example `status.json`:

```json
{
  "id": "scout-session-api",
  "runtime": "internal",
  "agent": "<resolved-live-agent>",
  "model": null,
  "task": "scout",
  "status": "success",
  "exitCode": null,
  "durationMs": 0,
  "timedOut": false,
  "attempts": 1,
  "worktree": null
}
```

When the harness reports usage or model identity reliably, record it as
observed metadata without changing the agent-owned model.

## Model Ownership

The resolved agent definition owns its model. Consequences:

- do not set `model:` on an internal job;
- a model-pinned job requires a live CLI route that supports the pin;
- do not assume two internal agents use different model families unless live
  metadata proves it;
- if independent-family review is required but unprovable internally, use a
  qualified CLI route or disclose the blocked constraint.

## Timeout

Unless the live harness exposes cancellation, internal timeouts are
accounting-only. When a job exceeds its bound:

- mark the attempt failed and `timedOut` for orchestration state;
- do not assume the underlying agent was force-killed;
- ignore late output unless the user explicitly approves recovery;
- scope future prompts more tightly instead of relying on timeout enforcement.

Never dispatch a second writer into the same ownership boundary while a timed
out internal agent may still be running.

## Resume

Resume uses `state.json` like other runtimes:

- successful jobs are skipped and their `result.md` is reused;
- interrupted jobs are re-dispatched as a new attempt;
- no subagent session continuity is assumed;
- prior partial evidence remains under `attempt-<n>/`;
- runtime and agent availability are revalidated before the new attempt.

## Boundaries

- Internal is fire-and-collect: one prompt in, one final result out.
- Multi-session teamwork and teammate messaging belong to a dedicated team
  workflow, not orchestrate.
- A single uncomplicated scout rarely justifies orchestration overhead — a
  direct `mk:scout` call is often enough.
- Internal agents consume the current session's resources and permission
  posture.
- Prompt-level worktree isolation prevents expected edit overlap but does not
  contain arbitrary process or network access.
