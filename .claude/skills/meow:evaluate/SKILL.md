---
name: meow:evaluate
version: 1.0.0
preamble-tier: 3
description: >-
  Use when grading a running build behaviorally — drives the artifact via
  browser/curl/CLI and grades against rubric criteria with concrete evidence.
  Distinct from meow:review (structural code audit). Triggers on /meow:evaluate,
  "evaluate this build", "grade the running app", "check the running site against
  the spec", or after a generator iteration completes.
argument-hint: "[target-url-or-path] [--rubric-preset frontend-app|backend-api|cli-tool|fullstack-product] [--max-criteria 15]"
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
source: meowkit
---

# meow:evaluate — Behavioral Active Verification

Step-file workflow that drives a running build, probes each rubric criterion via active verification, and produces a graded verdict with runtime evidence. Owned by the `evaluator` agent (Phase 3+).

## Trigger Conditions

Activate when:
- User runs `/meow:evaluate <target>` with a URL, file path, or running-app handle
- A generator iteration completes and the harness needs a graded verdict
- After Phase 3 (build) and before Phase 5 (ship) for frontend/fullstack/CLI products
- When asked to "grade the running app", "check the build behaviorally", or "verify against the spec"

Skip when:
- The build has no runnable artifact (pure library, type-only package)
- The task is structural code review only — use `meow:review` instead
- The task is `/meow:fix` simple — overhead exceeds value

## Hard Constraints

1. **Active verification gate** — every verdict MUST include non-empty `evidence/` directory with at least one of: screenshot, HTTP response capture, CLI stdout+exit-code transcript. `validate-verdict.sh` rejects PASS verdicts with empty evidence and converts them to FAIL.
2. **Skeptic persona enforced** — load `prompts/skeptic-persona.md` at session start. Re-anchor before each criterion grading.
3. **Max 15 criteria per session** — split into multiple sessions if rubric composition exceeds. Context overflow above this per research-01 §4.
4. **No source code edits** — evaluator owns `tasks/reviews/*-evalverdict.md` only. Never modifies source files.
5. **Frontend default preset is pruned** — `frontend-app` loads only product-depth, functionality, design-quality, originality (per Phase 2 v2.0.0 audit). Other 3 rubrics opt-in only.

## Workflow

Execute via `workflow.md`. Step-file architecture — load one step at a time.

```
Step 1: Load Rubrics       → compose preset, load skeptic persona, parse sprint contract if exists
Step 2: Boot App           → start the build if not already running (skip if URL given)
Step 3: Probe Criteria     → drive browser/curl/CLI per criterion; capture evidence
Step 4: Grade and Verdict  → score each rubric; write verdict file; run validate-verdict.sh
Step 5: Generator Feedback → produce one-line fix guidance per FAIL/WARN; emit handoff message
```

## Output

- `tasks/reviews/YYMMDD-{slug}-evalverdict.md` — structured verdict (YAML frontmatter + per-rubric sections)
- `tasks/reviews/YYMMDD-{slug}-evalverdict-evidence/` — directory of screenshots, HTTP captures, CLI transcripts
- Returned to caller: `PASS | WARN | FAIL` + path to verdict file + generator feedback summary

## Verdict Schema

See `step-04-grade-and-verdict.md` for the canonical schema. Frontmatter fields: `task`, `evaluator_run`, `rubric_preset`, `model`, `overall`, `weighted_score`, `hard_fail_triggered`, `iterations`.

## Gotchas

- **Don't grade source code** — that's `meow:review`'s job. If you find yourself reading `.tsx` files instead of clicking buttons, you've drifted into static review
- **Don't trust test pass claims** — tests can pass against mocks while the real endpoint 500s. Run the build yourself
- **Don't auto-load all 7 rubrics** — frontend-app preset is pruned to 4 (Phase 2 v2.0.0). Loading the others duplicates work meow:review/security-rules/qa already do
- **Don't issue PASS without evidence** — the validator will reject it and convert to FAIL. Save yourself the round-trip
- **Don't skip the skeptic persona reload** — leniency drift is the dominant evaluator failure mode per research-01 §6

## References

| File | Purpose |
|---|---|
| `workflow.md` | Step sequence + variable table |
| `step-01-load-rubrics.md` | Compose rubric preset + load skeptic persona |
| `step-02-boot-app.md` | Start the build if not running |
| `step-03-probe-criteria.md` | Active-verification probe loop per criterion |
| `step-04-grade-and-verdict.md` | Verdict file schema + scoring + validation |
| `step-05-feedback-to-generator.md` | Generator feedback format for iteration loop |
| `prompts/skeptic-persona.md` | Persona prompt fragment (re-load every session) |
| `references/active-verification-patterns.md` | Catalog of probe techniques per target type |
| `scripts/run-evaluator.sh` | Subagent spawn wrapper |
| `scripts/validate-verdict.sh` | Verdict file validator (enforces evidence gate) |
| `../meow:rubric/` | Rubric library + load/compose |
| `../../agents/evaluator.md` | The agent persona this skill orchestrates |

## Start

Read and follow `workflow.md`.
