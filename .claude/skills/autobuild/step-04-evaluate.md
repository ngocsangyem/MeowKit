# Step 4: Evaluate

**Goal:** a graded verdict backed by evidence from the running build, written by an `evaluator` subagent that did not write the code. Leniency is the failure mode: mark WARN when unsure.

**Inputs:** `handoff_path`, `contract_path` (or `null`), `plan_dir`, `iteration`.

## Do

1. Find the runnable target in the handoff (`target:` line: a URL or how to start it). Default to the project root, which `mk:evaluate` will boot.
2. Use the rubric preset the contract was bound to. With no contract, choose by project type: React, Vue, Svelte or Next dependencies mean `frontend-app`; a server framework and no UI means `backend-api`; a single binary means `cli-tool`; both frontend and backend means `fullstack-product`.
3. Dispatch the evaluator. It follows the Active Verifier Loop in `.claude/agents/evaluator.md` and runs `mk:evaluate` (its `workflow.md`).

```
Goal: a verdict on the build backed by evidence from the running artifact
Inputs: target {target}; rubric preset {preset}; handoff {handoff_path}; contract {contract_path, or "none: grade against the product spec"}; iteration {n} of {max_iter}
Files to modify: the verdict file and its evidence directory only; never source files
Constraints: a non-empty evidence/ directory (validate-verdict.sh turns an empty one into FAIL)
Return: the verdict path tasks/reviews/{slug}-evalverdict.md, PASS, WARN or FAIL, and a status (DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT)
```

4. Find the newest `tasks/reviews/{YYMMDD}[-HHMM]-{slug}-evalverdict.md` for the exact slug (a loose glob can match another slug's file), read its `overall:` line into `verdict`, and check it carries the `## Validator Stamp`. A missing file or stamp means there is no trusted verdict: treat it as FAIL and say why.
5. Append a Step 04 entry (verdict path, verdict, score, evidence count) to `run.md`, record cost per `workflow.md`, and run `budget-tracker.sh check`.

## Done when

A stamped verdict file exists with a non-empty evidence directory and `verdict` is `PASS`, `WARN` or `FAIL`.

## Next

`step-05-iterate-or-ship.md`.
