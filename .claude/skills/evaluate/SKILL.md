---
name: mk:evaluate
version: 1.0.0
preamble-tier: 3
description: "Drives a running build, records evidence. NOT for mk:review."
argument-hint: '[target-url-or-path] [--rubric-preset frontend-app|backend-api|cli-tool|fullstack-product] [--max-criteria 15]'
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
source: local
keywords:
  - evaluate
  - behavioral-verification
  - rubric-grading
  - running-build
  - active-verification
  - skeptic-persona
when_to_use: "Grade a built artifact."
user-invocable: true
owner: testing
criticality: high
status: active
runtime: claude-code
requires_runtime: [python>=3.9]
---

# mk:evaluate — Behavioral Verification

> Script paths in this skill's other files (references, steps) are relative to this skill's directory, `${CLAUDE_SKILL_DIR}`. Prefix them with `${CLAUDE_SKILL_DIR}/` before running them; do not run them from the project root.

Goal: drive a running build, probe each rubric criterion, and write a graded verdict that cites runtime evidence. The `evaluator` agent owns it. Grading the build is this skill's job; a test-and-repair pass on a site is `mk:qa`, and structural review of source is `mk:review`.

## When to Use

Activate when:
- User runs `/mk:evaluate <target>` with a URL, file path, or running-app handle
- A generator iteration completes and the harness needs a graded verdict
- After the build is green and before shipping, for frontend, fullstack and CLI products
- When asked to "grade the running app", "check the build behaviorally", or "verify against the spec"

Skip when:
- The build has no runnable artifact (pure library, type-only package)
- The task is structural code review only — use `mk:review` instead
- The task is `/mk:fix` simple — overhead exceeds value

## Hard Constraints

1. **Active verification required** — every verdict MUST include non-empty `evidence/` directory with at least one of: screenshot, HTTP response capture, CLI stdout+exit-code transcript. `validate-verdict.sh` rejects PASS verdicts with empty evidence and converts them to FAIL.
2. **Skeptic stance** — load `prompts/skeptic-persona.md` at session start, at the start of each batch, and before writing each PASS (PASS is where leniency creeps in). The stance is stated there once.
3. **Max 15 criteria per session** — split into multiple sessions if rubric composition exceeds. Heuristic: context overflow risk above this threshold.
4. **No source code edits** — evaluator owns `tasks/reviews/*-evalverdict.md` only. Never modifies source files.
5. **Frontend default preset is pruned** — `frontend-app` loads only product-depth, functionality, design-quality and originality; the other three rubrics overlap `mk:review`, the security rules and `mk:qa`, so they are opt-in.

## Workflow

Execute via `workflow.md`. Step-file architecture — load one step at a time.

```
Step 1: Load Rubrics       → compose preset, load skeptic persona, use the signed sprint contract's criteria if one exists
Step 2: Boot App           → start the build if not already running (skip if URL given)
Step 3: Probe Criteria     → drive browser/curl/CLI per criterion; capture evidence
Step 4: Grade and Verdict  → score each rubric; write verdict file; run validate-verdict.sh
Step 5: Generator Feedback → produce one-line fix guidance per FAIL/WARN; emit handoff message
```

## Where to run it

Run the evaluation inline for a short check (about three criteria). For a long session, dispatch it to a subagent so the probing evidence stays out of the main context (`scripts/run-evaluator.sh` prints the instructions).

Without a browser or screenshots, probe through text evidence instead: a DOM snapshot, an HTTP response capture or a CLI transcript. The evidence rule is the same: a verdict needs at least one saved artifact.

## Output

- `tasks/reviews/YYMMDD-{slug}-evalverdict.md` — structured verdict (YAML frontmatter + per-rubric sections)
- `tasks/reviews/YYMMDD-{slug}-evalverdict-evidence/` — directory of screenshots, HTTP captures, CLI transcripts
- Returned to caller: `PASS | WARN | FAIL` + path to verdict file + generator feedback summary

## Verdict Schema

See `step-04-grade-and-verdict.md` for the canonical schema. Frontmatter fields: `task`, `evaluator_run`, `rubric_preset`, `model`, `overall`, `weighted_score`, `hard_fail_triggered`, `iterations`.

## Gotchas

- **Don't grade source code** — that's `mk:review`'s job. If you find yourself reading `.tsx` files instead of clicking buttons, you've drifted into static review
- **Don't trust test pass claims** — tests can pass against mocks while the real endpoint 500s. Run the build yourself
- **Don't auto-load all 7 rubrics** — frontend-app preset is pruned to 4. Loading the others duplicates work `mk:review`, the security rules and `mk:qa` already do
- **Don't issue PASS without evidence** — the validator will reject it and convert to FAIL. Save yourself the round-trip
- **Don't skip the persona reload** — leniency drift is the dominant evaluator failure mode

## References

| File | Purpose |
|---|---|
| `workflow.md` | Step sequence + variable table |
| `step-01-load-rubrics.md` | Compose rubric preset + load skeptic persona |
| `step-02-boot-app.md` | Start the build if not running |
| `step-03-probe-criteria.md` | Active-verification probe loop per criterion |
| `step-04-grade-and-verdict.md` | Verdict file schema + scoring + validation |
| `step-05-feedback-to-generator.md` | Generator feedback format for iteration loop |
| `prompts/skeptic-persona.md` | The skeptic stance (reload per batch and before each PASS) |
| `references/active-verification-patterns.md` | Catalog of probe techniques per target type |
| `scripts/run-evaluator.sh` | Prints the dispatch instructions for running the evaluation in a subagent |
| `scripts/recompute-score.py` | Recomputes the weighted score and overall from the per-rubric verdicts |
| `scripts/validate-verdict.sh` | Verdict file validator (enforces the evidence requirement) |
| `../rubric/` | Rubric library + load/compose |
| `../../agents/evaluator.md` | The agent persona this skill orchestrates |

## Start

Read and follow `workflow.md`.
