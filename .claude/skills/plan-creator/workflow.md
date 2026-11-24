# Plan Creator Workflow

## Step-File Contract

- One step file at a time: read the whole file, do it, then follow its `Next`.
- Each step consumes the previous step's files, so skip only what the mode matrix says; that is the reason to follow the order, not a ban on judgment inside a step.
- A step states its done condition (a file that exists or a command that exits 0). State a step needs later goes in the plan directory, or in `.meowkit/state/{skill}-progress.json` when it must survive a context reset.
- A step that chains to `references/*.md` opens with a `## Contents` list, so a partial read lands on navigation.

## Mode matrix

Rows are modes; a dash means the step does not run. `plan check` is `mewkit plan check --structural`.

| Mode | Steps run | Researchers | Red team | Interview | `plan check` |
|---|---|---|---|---|---|
| fast | 0, 3, 4, 7, 8, 9 | 0 | - | - | yes |
| hard | 0, 1, 3, 4, 5, 6, 7, 8, 9 | 2 (1 for REDUCTION) | yes | yes | yes |
| deep | as hard, plus per-phase scouting in step 3 | 2-3 | yes | yes | yes |
| parallel | as hard, plus an ownership matrix | 2 | yes | yes | yes |
| two | as hard, but step 3 drafts two approaches and step 4 asks which to keep | 2 | on the chosen one | yes | yes |
| product-level | 0, 1, 3a, 4, 7, 8, 9 | 2 (broader) | - | - | no; `check-product-spec.sh` |
| spike | 0, 3, 4, 7, 9 | 0 | - | - | yes |

`deep`, `parallel` and `two` run the hard pipeline; `deep` and `two` do not choose an architecture, so an unclear approach goes to `mk:brainstorming` first. Step 3a replaces step 3 for product-level. Step 8 skips plans under 3 phases and plans without phase files.

## Steps

| Step | File | Purpose |
|---|---|---|
| 0 | `step-00-scope-challenge.md` | Route, classify, pick the mode, scope mode and flags; consolidate upstream artifacts |
| 1 | `step-01-research.md` | Create the plan directory, research unknowns, scout the codebase |
| 3 | `step-03-draft-plan.md` | Write `plan.md` and the phase files |
| 3a | `step-03a-product-spec.md` | Product-level spec instead of phases |
| 4 | `step-04-semantic-checks.md` | Semantic and structural checks, verification of cited claims, pruning |
| 5 | `step-05-red-team.md` | Adversarial review, adjudication, consistency sweep |
| 6 | `step-06-validation-interview.md` | Ask the decisions that change the plan, propagate, sweep |
| 7 | `step-07-gate.md` | Present the plan and settle it with the user |
| 8 | `step-08-hydrate-tasks.md` | Session tasks and integrity checks |
| 9 | `step-09-post-plan-handoff.md` | Record the next step, print the command, stop |

## Variables later steps read

`planning_mode`, `task_complexity`, `workflow_model`, `scope_mode`, `tdd_mode` (step 0); `intake_packet_path` (step 0); `plan_dir` (step 1 or 3); `selected_approach` (step 4, `two` only); `verification_tier` (step 4, read by step 6).

## Mode notes

- `--product-level`: step 3a runs a light scout of README, `docs/`, `brand/` and `tasks/plans/` only (never `src/` or schemas), keeps the result as working memory and out of `plan.md`, and hands off to `mk:autobuild`. `--no-design` skips the design subagent and `--no-scout` the scout.
- `--spike` needs `--timebox`, uses `assets/spike-plan-template.md` (investigate and findings phases, no test or ship) and is incompatible with `--product-level` and `mk:autobuild` FULL density.
- Mode flags and their research and phase effects: `references/modes-and-flags.md`.
