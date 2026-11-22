<!-- Lifecycle canonical source: .claude/skills/workflow-orchestrator/workflow.yaml — autobuild steps are Step 0–6 (distinct from the 7 lifecycle phases) -->

# Step 2: Sprint Contract

**Goal:** a signed contract that says what the generator will build and how the evaluator will test it, so neither can quietly substitute a different goal. This is a fragile step: when there is a contract, nothing is generated until it is signed.

**Inputs:** `plan_dir`, `slug`, `density`.

## Skip or run

- `MINIMAL`: already left at step 0.
- `LEAN`: skip when the product spec is small enough that the generator can hold its own criteria (a handful of features). Set `contract_path=null`, note the reason in `run.md` and go to step 3.
- `FULL`: always run.

## Run

Use `mk:sprint-contract` (propose, review, sign). The contract template is `.claude/skills/sprint-contract/assets/contract-template.md` and rubric presets come from `.claude/skills/rubric/scripts/load-rubric.sh`. Write as many acceptance criteria as the sprint needs, each in Given/When/Then form with a Verification line and a rubric tie-in. If the contract fits on one page, drafting and reviewing it yourself is fine; otherwise use two subagents.

Proposer brief (`developer`):

```
Goal: a sprint contract the generator and evaluator can both sign
Task: mk:sprint-contract propose for {slug}, from {plan_dir}/plan.md and a rubric preset that fits the project type
Files to modify: tasks/contracts/{YYMMDD-HHMM}-{slug}-sprint-1.md
Constraints: do not edit source code or the product spec
Return: the contract path and a status (DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT)
```

Reviewer brief (`evaluator`, using its Contract Reviewer Role in `.claude/agents/evaluator.md`):

```
Goal: a contract whose criteria can each be tested
Task: review tasks/contracts/*-{slug}-sprint-1.md and append your round to its Negotiation Log
Files to modify: the Negotiation Log only
Return: "accepted" or the findings, and a status (DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT)
```

At most 2 propose-review rounds; a third goes to the user.

## Done when

`grep -E '^(generator_signed|evaluator_signed|status):'` on the contract shows a real commit SHA in both signature fields and `status: signed`. A placeholder (`null`, `pending`, `todo`, empty) means that agent has not signed: stop and ask the user.

Append the contract path, AC count and rounds to `run.md`, and run `budget-tracker.sh check`.

## `--advice` GUIDE checkpoint

Only with `--advice`. This is the run's one GUIDE call: the plan and the contract decision are settled and nothing is generated yet. Fire it here, before step 3, per `references/advice-checkpoints.md`. A directive feeds the generator's brief; it does not amend the signed contract or grant what the contract withholds.

## Next

`step-03-generate.md`.
