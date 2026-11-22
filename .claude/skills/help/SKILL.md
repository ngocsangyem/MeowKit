---
name: mk:help
description: "Names the next workflow step from plans, tests, git."
argument-hint: '[--verbose]'
source: local
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
keywords:
  - help
  - command-reference
  - skill-discovery
  - usage-guide
  - onboarding
  - catalog-listing
when_to_use: "Asked 'what next?'."
user-invocable: true
owner: research
criticality: medium
status: active
runtime: claude-code
---

# Navigation Help

Answers "what should I do next?" from the state the project already holds, and names one
step with up to two alternates, each citing the file or command it came from. Read-only:
it reads state and never writes it.

Use it when the user asks what to do next or where to pick up. Not for what is done or
blocked (backward-looking delivery status): that is `mk:status`.

## How to answer

Ask the project, do not re-derive its state by hand:

1. `mewkit orient` -- durable task state: the active task, its step and its next action.
   If it names a next action, that is the rank-1 candidate.
2. `mewkit plan status <plan-dir>` -- checkbox progress for one plan under `tasks/plans/`.
   Use its counts as the progress figure; do not count `- [x]` by hand.
3. `tasks/reviews/*-verdict.json` -- the newest verdict. A verdict is blocked when
   `decision` is `BLOCKED` (the enum is `PASS | PASS_WITH_RISK | BLOCKED`; `FAIL` exists only
   per dimension in `dimensions[].verdict`). The `.md` verdict is the prose fallback.
4. `git status` -- uncommitted changes, ignoring IDE noise.

Optional signals, read only if present: `.meowkit/state/checkpoints/checkpoint-latest.json`
(`created_at`, `progress.plan_path`), `.meowkit/state/budget-state.json` (advisory cost and
`warnings_emitted`), `.meowkit/state/detected-model.json` (the current-session tier; never take
the tier from `budget-state.json`) and `docs/development-roadmap.md` (milestone). An absent
file is normal at rest: skip silently and mention the skip only under `--verbose`.

Rank what you found: a blocked verdict or phase first (cite the failing dimension), then a
plan phase in progress (cite the `plan status` counts), then an approved plan with nothing
built, then the clean-state fallback. Fold a budget caution into the rank-1 rationale when
`warnings_emitted > 0` or spend is at or above $30. For a task-type to skill mapping see
`../agent-detector/references/lifecycle-routing.md`. CLI flags: `references/cli.md`.

## State to recommendation

| State | Phase | Recommendation |
|---|---|---|
| No plan | 0 to 1 | `/mk:plan-creator`, or describe the task |
| Plan agreed, TDD on (`--tdd` or `MEOWKIT_TDD=1`) | 2 | tester agent: write failing tests (RED) |
| Plan agreed, TDD off (default) | 3 | skip Phase 2; developer agent builds |
| Tests failing | 3 | developer agent: implement to pass |
| Build green, not simplified | 3.5 | `/mk:simplify` |
| Simplified, not verified | 3.6 | `/mk:verify` |
| Verified, no review | 4 | `/mk:review` |
| Verdict `PASS` or `PASS_WITH_RISK` | 5 | `/mk:ship` |
| Verdict `BLOCKED` | 4 | fix the named dimension, then `/mk:review` again |
| Shipped | 6 | documenter agent, then `/mk:retro` |
| Plan to stress-test, interview or archive | any | `/mk:plan-creator red-team`, `validate` or `archive` with the plan path |
| Several plans or tasks in progress | any | ask which to focus on |
| Nothing in flight | 0 | start a task, run `/mk:retro`, or ask |

Phases run in order; skip only what the `mk:scale-routing` result or the user says to skip.
`/mk:fix` is the short path for a small bug, typo or config tweak: the scope is the plan, and
the diff is still reviewed before shipping. Security hooks and the ship check always run.

## Specialist skills (suggest when the domain matches)

| Situation | Skill |
|---|---|
| Case routing, triage or escalation design | `/mk:decision-framework` |
| "Is everything green?", pre-review health check | `/mk:verify` |
| API contract design or review | `/mk:api-design-principles` |
| Backend change across handler, service, job | `/mk:backend-development` |
| Schema, migration, query | `/mk:database` |
| Containers, CI/CD, deployment, rollback | `/mk:devops` |

## Gotchas

- Several in-progress plans are ambiguous: ask which to focus on; do not guess.
- State from an earlier session may be stale: check timestamps and warn past 24 hours.
- `.meowkit/state/checkpoints/` does not exist until runtime; its absence is not an error.
- Prefer `*-verdict.json` over the `.md` verdict.
- Fast paths are not loopholes: review the diff before shipping.
- This is the forward-looking navigator; delivery status stays with `/mk:status`.
- If `mewkit` is not on the PATH, fall back to reading `tasks/plans/` and `tasks/reviews/`
  directly and say the answer is less certain.

## Output

```
## Status
**Current phase:** [Phase N - Name]
**State:** [one line]

### Recommended next step
[action] -- [rationale, citing its source]

### Other options
- [action] -- [one-line rationale]
```

With `--verbose`, also list which optional signals were present and which were skipped.
