---
title: "mk:evaluate"
description: "Behavioral active verification — drives running build via browser/curl/CLI and grades against rubric criteria with concrete evidence."
---

# mk:evaluate

Step-file workflow that drives a running build, probes each rubric criterion via active verification, and produces a graded verdict with runtime evidence. Owned by the `evaluator` agent (Phase 3+). NOT for structural code audit (use `mk:review`) or static linting (use `mk:lint-and-validate`).

## When to use

- User runs `/mk:evaluate <target>` with URL, file path, or running-app handle
- Generator iteration completes and harness needs a graded verdict
- After Phase 3 (build) and before Phase 5 (ship) for frontend/fullstack/CLI products

Skip when: build has no runnable artifact (pure library, type-only package), task is structural code review only, or task is `/mk:fix simple`.

## Hard constraints

1. **Active verification gate** — every verdict MUST include non-empty `evidence/` directory (screenshot, HTTP response, CLI transcript). `validate-verdict.sh` rejects PASS with empty evidence → auto-converts to FAIL.
2. **Skeptic persona enforced** — load skeptic persona at session start. Re-anchor before each criterion.
3. **Max 15 criteria per session** — split into multiple sessions if rubric composition exceeds this.
4. **No source code edits** — evaluator owns `tasks/reviews/*-evalverdict.md` only.
5. **Frontend default preset is pruned** — `frontend-app` loads only 4 of 7 rubrics (product-depth, functionality, design-quality, originality).

## Usage

```bash
/mk:evaluate http://localhost:3000 --rubric-preset frontend-app
/mk:evaluate ./dist/app --rubric-preset cli-tool --max-criteria 10
```
