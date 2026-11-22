# Step 3: Generate

**Goal:** the contract's scope built, committed and handed off by a `developer` subagent that grades itself against whichever document holds the criteria.

**Inputs:** `plan_dir`, `contract_path` (or `null`), `iteration`, and on rounds after the first the prior verdict and feedback packet.

## Do

1. Confirm the contract is signed (or null with a reason logged), `plan_dir` exists, and `budget_spent` is below the cap.
2. Increment `iterations` in the `run.md` frontmatter. The counter lives there, not in session memory, so a restarted run knows which round it is in.
3. Dispatch the generator. It follows the Implementation Sub-Phases in `.claude/agents/developer.md` (understand, design direction, implement, verify against its self-eval checklist, handoff). For parallel generation read `.claude/skills/cook/references/parallel-execution-rules.md` first.

```
Goal: the contract's scope built and committed
Inputs: plan {plan_dir}/plan.md; contract {contract_path, or "none: work from the product spec"}; iteration {n} of {max_iter}; density {density}; on later rounds the prior verdict {verdict_path} and feedback packet (address every FAIL and WARN finding)
Files to modify: the files the contract scope names; nothing on its out-of-scope list
Constraints: commit per criterion; build and type-check with zero errors; self-eval checklist fully checked before handoff; write the handoff to tasks/handoff/{slug}-sprint-1.md and mark the sprint ready_for_evaluator in progress.md
Return: the handoff path and a status (DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT)
```

4. If the developer returned `BLOCKED` or no handoff exists, set `final_status=FAIL` and `next_step: step-06-run-report.md`, and go there.
5. Append a Step 03 entry (iteration, handoff path, self-eval outcome, files changed) to `run.md`, record cost per `workflow.md`, and run `budget-tracker.sh check`. On a block, `final_status=TIMED_OUT` and go to step 6.

## Done when

The handoff file exists, the work is committed with a clean status, and the budget check passed.

## Next

`step-04-evaluate.md`.
