# mk:autobuild — Workflow

Seven steps, numbered 0–6, run in order: tier detection, plan, contract, generate, evaluate, iterate or ship, run report.

## Step-File Contract

- Load one step file at a time, read all of it before acting on it, and finish it before opening the next, because each step consumes the previous step's output.
- Keep the step order; a step whose goal cannot be met stops the run and goes to the report.
- Exact wording matters only at the fragile steps the step files name (budget check, ship question, signed contract); elsewhere reach the step's goal by judgment.
- Persist what the next step needs in `run.md` frontmatter, so it survives a context reset.

## Run state

`tasks/autobuild-runs/{run_id}/run.md` is the run's state and its audit trail. Its frontmatter holds `run_id`, `density`, `model`, `budget_cap`, `budget_spent`, `iterations`, `status`, `next_step`, `started`, and `supervisionRunId` when `--advice` is on. A step reads it on entry and updates it with the edit tool on exit. `next_step` names the file to open after the current step and defaults to the next in order; it lives in the file so a subagent or a restarted session finds it. Step 6 owns the final report format.

`run_id` is `YYMMDD-HHMM-{slug}`, with a short kebab-case slug of the task. A killed run restarts from `run.md`: open the file named by `next_step`; finished steps are not repeated.

## Shared rules

- **Iteration cap.** `--max-iter`, default 3. At the cap, ask the user.
- **Report always.** Step 6 runs on every end state: pass, fail, timeout, escalation.
- **Commit per step**, so the run can restart from the last finished step.
- **Budget.** After each step that spends, run `scripts/budget-tracker.sh check`. Exit 0 is fine, 1 a warning, 2 or 3 halts the run with `final_status=TIMED_OUT`. Record cost with `budget-tracker.sh add <usd> <step>` only from a figure the host reported; otherwise record `0.00` rather than an estimate, because the budget gate is only as good as its input. Thresholds: `.meowkit/config.yaml`.
- **Wall-clock.** At 6 hours, stop and report.
- **Evaluator separation.** The generator never grades its own work; the evaluator runs the build and cites evidence from it. A density override or `--tier` changes the scaffolding, not that rule or the review.
- **Subagent returns.** Every brief asks for the four-status block (`DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`, `.claude/rules/agent-conduct.md`) plus the artifact path. `BLOCKED` and `NEEDS_CONTEXT` get an answer (more context, a smaller task, or the user) before any retry; the same approach is not retried.
- **Briefs** carry the goal, the fixed constraints, the files in scope and the return shape (template: `.claude/skills/cook/references/orchestration-rules.md`). Do the work in the session instead of delegating when it is small and sequential.

## Variables

| Variable | Set by | Meaning |
|---|---|---|
| `task_description` | invoker | the original task |
| `density` | step 0 | `MINIMAL`, `FULL` or `LEAN` |
| `run_id`, `run_dir` | step 0 | run identity and `tasks/autobuild-runs/{run_id}/` |
| `plan_dir`, `slug` | step 1 | product plan directory and task slug |
| `contract_path` | step 2 | signed contract, or `null` when skipped |
| `handoff_path` | step 3 | generator handoff file |
| `verdict_path`, `verdict` | step 4 | evaluator verdict file and `PASS`, `WARN` or `FAIL` |
| `iteration`, `max_iter` | step 3, invoker | current round and the cap |
| `budget_cap`, `budget_spent` | invoker, steps | USD |
| `final_status` | step 5 | `PASS`, `WARN`, `FAIL`, `ESCALATED` or `TIMED_OUT` |

`final_status` has no other values. A user who ships a build despite a FAIL at the cap is recorded as `FAIL` with the decision noted in the report, not as a new status.

## Density

A one-line summary; the matrix owns the rules. `MINIMAL` hands the task to `mk:cook`. `FULL` runs every step with a required contract and up to 3 rounds. `LEAN` makes the contract optional and expects 0–1 rounds. The selection order and the model table are in `references/adaptive-density-matrix.md`.

## End states and returns

| End state | Return status |
|---|---|
| shipped or accepted by the user, no unresolved WARN | `DONE` |
| shipped or accepted with WARNs or a FAIL the user accepted | `DONE_WITH_CONCERNS` |
| budget block, timeout, escalation, or a step that cannot continue | `BLOCKED` |
| the task or spec is too vague to plan | `NEEDS_CONTEXT` |

Start with `step-00-tier-detection.md`.
