---
name: mk:cook
description: "Implements one feature or plan end to end. NOT for mk:autobuild."
source: local
version: 1.0.0
argument-hint: '[task|plan-path] [--interactive|--fast|--parallel|--auto|--no-test|--tdd|--verify|--strict|--no-strict|--advice]'
keywords:
  - cook
  - implement-pipeline
  - plan-execution
  - feature-build
  - seven-phase
  - single-task
when_to_use: "One scoped feature."
user-invocable: true
owner: lifecycle
criticality: critical
status: active
runtime: claude-code
dependency_edges:
  - id: mk:autobuild
    type: peer
  - id: mk:evaluate
    type: peer
  - id: mk:investigate
    type: peer
  - id: mk:memory
    type: peer
  - id: mk:plan-creator
    type: peer
  - id: mk:review
    type: peer
  - id: mk:scout
    type: peer
  - id: mk:ship
    type: peer
  - id: mk:simplify
    type: peer
  - id: mk:testing
    type: peer
  - id: mk:verify
    type: peer
---

# Cook

> Script paths in this skill's other files are relative to this skill's directory, `${CLAUDE_SKILL_DIR}`. Prefix them with it before running; do not run them from the project root.

Take one scoped feature, fix or refactor from an agreed plan to reviewed, verified code, and stop there. Shipping and closing out are separate requests.

Not for a green-field product build with many sprints: use `mk:autobuild`. Not for diagnosing a bug: use `mk:fix` or `mk:investigate`. Cook runs the build; `mk:plan-creator` writes the plan.

<!-- Canonical source: workflow.yaml — the lifecycle diagram renders the same lifecycle; -->
<!-- Workflow phase sequence: 0:Orient > 1:Plan > 2:Test > 3:Build > 3.5:Simplify > 3.6:Verify > 4:Review > 5:Ship > 6:Reflect -->
<!-- the YAML is the machine-readable authority; the Mermaid diagram is the human-facing render. -->

`.claude/skills/workflow-orchestrator/workflow.yaml` owns the phase sequence; this skill picks a profile and calls the owner of each phase.

## Done means

- The plan is agreed with the user (a plan path you were given counts as agreed).
- `mk:verify` is green on the final code, after `mk:simplify`.
- A review verdict exists under `tasks/reviews/` and you have read it; a FAIL dimension or a security BLOCK went back to Build.
- Every acceptance criterion in the plan is checked, and the run summary says so.

Spawning agents is not evidence of any of these.

## Profiles and flags

Profiles: `quick`/`--fast` (inspect → edit → focused verify → summary), `standard` (plan if needed → implement → verify → review), `release` (standard + explicit `mk:ship` request), and `high-assurance` (`--tdd --strict`, with the plan and the review verdict walked through with the user).

`quick` and `--fast` are one profile. They skip external research and shorten the scout summary to 1-3 bullets. A trivial change (2 files or fewer, about 30 minutes or less, per `.claude/rules/meowkit-core.md`) needs no plan and no reviewer. A non-trivial change keeps its agreed plan, `mk:verify` and its review verdict even under `--fast`, and any risk flag or changed contract moves the run to `standard`.

Modes come from the flags and the input: `--interactive` (default) | `--fast` | `--parallel` | `--auto` | `--no-test`. A path to `plan.md` / `phase-*.md` selects code mode (Execute existing plan; skip research and planning). `--no-test` with `--tdd` is invalid: ask the user which intent applies. Detection order, the Research/TDD table per mode and edge cases: `references/intent-detection.md` (open it when the mode is unclear).

Modifiers layer on any mode: `--verify` (light browser or artifact check, advisory), `--strict` (full `mk:evaluate` pass; an evaluator FAIL goes back to Build), `--no-strict` (suppress auto-strict from `mk:scale-routing`). `[LIGHT]` and `[HEAVY]` are relative costs only. `--strict` supersedes `--verify`.

`--tdd` (or `MEOWKIT_TDD=1`) turns on RED-first tests; without it Phase 2 is optional. The `tdd-flag-detector` hook writes the `.meowkit/state/tdd-mode` sentinel; if the hook did not run on this host, write `on` to that file yourself before the first phase, because downstream agents read it to know the mode. A plan that carries `tdd: true`, `## Tests Before` or `## Regression Gate` but a run without `--tdd` gets one warning to the user. Rules: `references/tdd-rules.md`.

## Phases in short

The full per-phase instructions are in `references/workflow-steps.md`. Open it at Phase 1, and read `references/phase-contracts.md` once at Phase 0.

- **0 Orient.** Declare the tier (TRIVIAL, STANDARD or COMPLEX; auth, payments and security are COMPLEX). Present a 3-6 bullet scout summary before any clarifying question: stack, relevant files, existing patterns, in-flight plans, contracts the task could affect. Skip it when given a plan path.
- **1 Plan.** `mk:plan-creator` returns a plan that answers five things in concrete sentences: expected output, acceptance criteria, scope boundary, non-negotiable constraints, touchpoints. Every clarifying option cites a scout finding. Write the plan and agree it with the user before implementation code, because a wrong plan costs more than the conversation; no hook blocks the edit, so the practice is the control. Skip only when the user says so and Phase 0 matched no risk flag; note what was skipped.
- **2 Test.** RED tests under `--tdd`; optional otherwise.
- **3 Build.** `developer` implements the phase file. Tests failing after three different attempts go to `mk:investigate`; three more failures stop the run and go to the user with the output, the attempts and a suspected cause.
- **3.5 Simplify.** `mk:simplify` on the green code, because reviewers find logic errors faster in simple code.
- **4 Review.** `reviewer` via `mk:review` writes the verdict. See `references/review-cycle.md`.
- **5 Ship, 6 Reflect.** Only on request, below.

## Verify Step (Mandatory)

After `mk:simplify`, run `mk:verify`: build, lint, type-check, test and coverage. It scopes lint and tests to the changed files by default; pass `--full` only when a whole-project sweep is needed now, since ship time runs the complete check. A failing result goes back to the developer and `mk:verify` re-runs before Phase 4: a review of code that does not build wastes the reviewer.

## After the review

Report completion and stop. Phase 5 starts only after an explicit ship request, via `shipper` and `mk:ship`; a PASS verdict is not a request. Phase 6 starts on an explicit close request: run `mewkit plan sync` on the plan directory, state `Docs impact: none|minor|major` and update affected docs. Spawn `analyst`, `documenter` or `mk:memory` only when the run was large enough to need them; usually the memory write is nothing. A review verdict of PASS on a multi-phase plan also warrants one background `project-manager` report per `references/post-phase-delegation.md`.

Regression, side effect or broken existing behaviour in the verdict: follow Regression Recovery Options in `references/review-cycle.md` instead of patching silently.

## When to delegate

Delegate a phase to a subagent when it is independent, read-heavy or needs a fresh context (scout, research, review, evaluate). Do the work in the session when it is small, sequential or touches the same files as the step before. Every brief carries the goal, the fixed constraints, the files in scope and the return shape; the template is in `references/orchestration-rules.md`. A subagent ends with the four-status block (`DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`) from `.claude/rules/agent-conduct.md`.

## Stop and report

Stop and tell the user, instead of working around it, when: the plan's premise fails against the code (an `[ASSUMPTION]` is false), acceptance criteria cannot be met within the scope boundary, `--tdd` and `--no-test` conflict, or review cycles hit the cap in `references/review-cycle.md`. During long build-test-fix loops follow `references/loop-safety-protocol.md`.

## `--advice` (composable, off by default)

Opt-in strategic supervision for one run by the `athena` agent at named checkpoints (GUIDE once the plan is agreed, RESCUE on a stall, REVIEW after Verify, RECHECK after a correction; hard cap 5). It never approves: the plan and the verdict stay with the user and the reviewer, and supervision counts as no verification. Without the flag there are zero calls. Checkpoints: `references/advice-checkpoints.md`; contract: `.claude/skills/advise/references/advice-supervision-rules.md` (load only when the flag is present).

## Gotchas

Failure modes and rationalizations: `references/failure-catalog.md` (read it before a non-trivial build). Operational ones:

- **`--auto` hides a bad review.** Auto mode fixes and continues without pausing, so nobody reads the verdict as it is written. Read the verdict and the evidence index at the end of an auto run before shipping.
- **Context loss between phases.** After each completed plan phase, tick its checkboxes, run `mewkit plan sync <plan-dir>` and update the plan.md Agent State, so a fresh session resumes at the right phase. Never hand-write `.plan-state.json`; the CLI derives it from the checkboxes.
- **Parallel deadlocks.** Map the dependency graph before spawning parallel agents; phase-03 waiting on phase-02 deadlocks them.
- **Stale plans.** A plan older than 14 days may not match the code; warn before running it.
- **Fast mode tests.** Skipping research means tests capture plan intent, not edge cases; say so in the summary.
- **`--strict` cost.** It runs the full evaluator and is auto-triggered by `mk:scale-routing` `level=high`; `--no-strict` suppresses it.

## Rule Loads (just in time)

Read each file at the point named, and nothing else from this list.

| Load at | File | Why |
| --- | --- | --- |
| Phase 0 | `references/phase-contracts.md` | what each phase expects and produces |
| Unclear mode | `references/intent-detection.md` | detection order and the per-mode table |
| Phase 1 onward | `references/workflow-steps.md` | per-phase instructions |
| Before a non-trivial build | `references/failure-catalog.md` | known failure modes |
| Phase 2, TDD only | `references/tdd-rules.md` | RED definition, self-heal cap, escalation |
| Phase 3, parallel only | `references/parallel-execution-rules.md` | zero-overlap ownership, max 3 agents, worktrees |
| Any subagent spawn | `references/orchestration-rules.md` | brief template, isolation, status handling |
| Subagent prompts | `references/subagent-patterns.md` | per-phase brief shapes |
| Phase 4 | `references/review-cycle.md` | acting on the verdict |
| `--strict` | `references/harness-rules.md` | generator is not the evaluator; active verification |
| Build-test-fix loops | `references/loop-safety-protocol.md` | checkpoints, stall detection |
| After a PASS verdict | `references/post-phase-delegation.md` | project-manager fire points and skips |
| Active durable task | `references/task-state-emission.md` | task-state events (advisory) |
| Naming or project-context questions | `references/agent-conduct-extended.md` | conduct rules loaded on demand |

## Related Rules

- `.claude/rules/meowkit-core.md` — phase sequence, planning and review as practices, the ship check
- `.claude/skills/advise/references/workflow-evidence-rules.md` — the evidence index that records what happened (never approves); see `references/workflow-steps.md`
