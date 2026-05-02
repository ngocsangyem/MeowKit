---
title: "mk:evaluate"
description: "Behavioral active verification — drives running build via browser/curl/CLI and grades against rubric criteria with concrete evidence. Owned by the evaluator agent (Phase 3+)."
---

# mk:evaluate

Step-file workflow that drives a running build, probes each rubric criterion via active verification, and produces a graded verdict with runtime evidence. Owned by the `evaluator` agent (Phase 3+). NOT for structural code audit of a diff/PR (use `mk:review`); NOT for static linting (use `mk:lint-and-validate`).

## What This Skill Does

- Composes rubric presets from the rubric library via `mk:rubric compose `PRESET`
- Boots the target build if given a path (skips if a URL is already running)
- Probes every loaded criterion by actively driving the build (browser, curl, CLI)
- Captures concrete evidence (screenshots, HTTP responses, CLI transcripts) for every finding
- Grades each criterion against rubric anchor examples, producing a PASS/WARN/FAIL verdict
- Runs `validate-verdict.sh` to enforce the active-verification gate (no PASS without evidence)
- Produces one-line fix guidance per FAIL/WARN finding for the generator agent

## When to Use

Activate when:
- User runs `/mk:evaluate `TARGET` with a URL, file path, or running-app handle
- A generator iteration completes and the harness needs a graded verdict
- After Phase 3 (build) and before Phase 5 (ship) for frontend/fullstack/CLI products
- When asked to "grade the running app", "check the build behaviorally", or "verify against the spec"

Skip when:
- The build has no runnable artifact (pure library, type-only package)
- The task is structural code review only -- use `mk:review` instead
- The task is `/mk:fix` simple -- overhead exceeds value

## Example Prompt

```
Evaluate the running frontend at http://localhost:3000 against the frontend-app rubric preset. Drive every acceptance criterion — login flow, user dashboard, form submission, error states — capture screenshots for evidence, and produce a graded PASS/WARN/FAIL verdict with fix guidance.
```

## Core Capabilities

### 5-Step Workflow

| Step | Name | What It Does |
|------|------|-------------|
| 1 | Load Rubrics | Detect target type, compose rubric preset via `mk:rubric`, load skeptic persona, parse sprint contract (if exists), build criterion list (capped at 15) |
| 2 | Boot App | Start the build if path given; skip if URL already running; health check; capture build console |
| 3 | Probe Criteria | For each criterion: pick probe technique, drive the build, capture evidence, grade against rubric anchors, record finding |
| 4 | Grade and Verdict | Aggregate findings per rubric, compute weighted score, check hard-fail thresholds, write verdict file, run `validate-verdict.sh` |
| 5 | Generator Feedback | Build fix guidance list for FAIL/WARN findings, append to verdict file, emit handoff message, cleanup booted processes |

### Hard Constraints

1. **Active verification gate** -- every verdict MUST include non-empty `evidence/` directory with at least one of: screenshot, HTTP response capture, CLI stdout+exit-code transcript. `validate-verdict.sh` rejects PASS verdicts with empty evidence and converts them to FAIL.
2. **Skeptic persona enforced** -- load `prompts/skeptic-persona.md` at session start. Re-anchor before each criterion grading. Leniency drift is the dominant evaluator failure mode.
3. **Max 15 criteria per session** -- split into multiple sessions if rubric composition exceeds this. Heuristic: context overflow risk above this threshold.
4. **No source code edits** -- evaluator owns `tasks/reviews/*-evalverdict.md` only. Never modifies source files.
5. **Frontend default preset is pruned** -- `frontend-app` loads only 4 rubrics: product-depth, functionality, design-quality, originality (per Phase 2 v2.0.0 audit). The other 3 rubrics (code-quality, craft, ux-usability) opt-in only.

### Verdict Schema

The verdict file at `tasks/reviews/YYMMDD-{slug}-evalverdict.md` uses canonical frontmatter:

```yaml
task: {task-name}
slug: {slug}
evaluator_run: {ISO-8601 timestamp}
rubric_preset: {preset-name}
model: {model-id}
overall: PASS | WARN | FAIL
weighted_score: 0.78
hard_fail_triggered: false
iterations: {N}
```

Verdict derivation:
- `hard_fail_triggered` = any rubric meets or exceeds its `hard_fail_threshold` (FAIL or WARN)
- If hard_fail: overall = FAIL
- Else if weighted_score >= 0.85: overall = PASS
- Else if weighted_score >= 0.65: overall = WARN
- Else: overall = FAIL

## Arguments

```
/mk:evaluate <target-url-or-path> [--rubric-preset frontend-app|backend-api|cli-tool|fullstack-product] [--max-criteria 15] [--no-boot]
```

| Flag | Purpose |
|------|---------|
| `` `TARGET` `` | URL (`http://localhost:3000`), path (`./apps/web`), or CLI binary (`./bin/mytool`) |
| `--rubric-preset` | Override auto-detected preset |
| `--max-criteria` | Cap criteria count (default: 15) |
| `--no-boot` | Skip step-02 boot (target must be a URL) |

**Target type auto-detection:**

| Pattern | `target_type` | Default Preset |
|---|---|---|
| Starts with `http://` or `https://` | `frontend-url` (or `backend-url` if API) | `frontend-app` / `backend-api` |
| Path ends in executable / has shebang | `cli-binary` | `cli-tool` |
| Path is a directory with `package.json` etc. | `frontend-path` or `backend-path` | `frontend-app` / `backend-api` |
| Mixed full-stack | user-provided spec | `fullstack-product` |

## Workflow

Execute via `workflow.md`. Step-file architecture -- load one step at a time, never load multiple steps simultaneously, never skip steps.

```
target arg + preset arg
    |
Step 1: Load Rubrics
    |-- Detect target type
    |-- compose <preset> via mk:rubric
    |-- Load skeptic-persona.md
    |-- Parse sprint contract (if exists, Phase 4+)
    |-- Flatten criteria; cap at 15
    |-- Create evidence_dir
         |
Step 2: Boot App (conditional)
    |-- URL target: health check only
    |-- Path target: start build, poll until ready (max 30s)
    |-- CLI target: smoke test with --help/--version
    |-- Capture build console as first evidence
         |
Step 3: Probe Criteria (loop)
    |-- For each criterion (max 15):
    |   |-- Re-anchor skeptic persona
    |   |-- Pick probe technique from active-verification-patterns.md
    |   |-- Drive the build (browser / curl / CLI)
    |   |-- Capture evidence (screenshot / response / transcript)
    |   |-- Grade against rubric anchors (NOT intuition)
    |   |-- Record finding
         |
Step 4: Grade and Verdict
    |-- Aggregate findings per rubric
    |-- Compute weighted_score
    |-- Check hard_fail thresholds
    |-- Write verdict file
    |-- Run validate-verdict.sh (HARD GATE)
    |-- If validator rejects: fix or convert PASS -> FAIL
         |
Step 5: Generator Feedback
    |-- Pull FAIL/WARN findings
    |-- Write one-line fix guidance per finding
    |-- Append to verdict file
    |-- Emit handoff message with overall verdict
    |-- Cleanup booted processes
    |-- Return PASS|WARN|FAIL + verdict_file path
```

### Probe Techniques (from `references/active-verification-patterns.md`)

| Criterion Type | Probe Pattern | Tool |
|---|---|---|
| "Feature X works end-to-end" | UI flow: navigate, click, type, assert result | `mk:agent-browser` or `mk:playwright-cli` |
| "API endpoint returns expected shape" | curl + jq assertion on response shape | `bash` |
| "Form submission persists data" | UI flow + follow-up GET (round-trip verification) | `mk:agent-browser` + `bash` |
| "Error states render gracefully" | Trigger error (bad input, network kill), screenshot result | `mk:agent-browser` |
| "Time-to-value 90s" | Navigate landing, measure clicks/seconds to first value action | `mk:agent-browser` (timed) |
| "No console errors on happy path" | Open page, exercise main flow, capture browser console log | `mk:agent-browser` (log capture) |
| "Design language consistent" | Screenshot every primary screen, compare typography/color/spacing | `mk:agent-browser` (multi-screenshot) |
| "Originality -- non-generic copy" | Read hero copy + product name, match against anti-patterns | `mk:agent-browser` + pattern-match |
| "CLI exit codes correct" | Invoke binary with intentional bad input, check exit code | `bash` |
| "CLI --help is comprehensive" | Run `binary --help`, capture stdout, check for examples + exit codes | `bash` |

### Skeptic Persona

Loaded at session start and re-anchored before each criterion. The persona:
- Assumes bugs exist and has not finished verifying until proven otherwise
- Treats WARN as the honest middle when unsure, never defaulting to PASS
- Requires concrete evidence for every verdict (narrative-only findings are rejected)
- Actively hunts: stub features, silent feature substitution, mocked verification, AI slop signatures, missing wiring, layout gaps, onboarding walls, self-praise rationalizations
- Anti-rationalization counters for: "it looks fine", "the tests pass", "edge case not a real user", "it's just a prototype"

## Usage

```bash
# Evaluate a running frontend
/mk:evaluate http://localhost:3000 --rubric-preset frontend-app

# Evaluate a CLI tool from its binary path
/mk:evaluate ./dist/app --rubric-preset cli-tool --max-criteria 10

# Evaluate a backend API (auto-detects)
/mk:evaluate http://localhost:8080/api

# Skip boot (already running)
/mk:evaluate http://localhost:3000 --no-boot
```

## Output

- `tasks/reviews/YYMMDD-{slug}-evalverdict.md` -- structured verdict with YAML frontmatter + per-rubric results + validator stamp
- `tasks/reviews/YYMMDD-{slug}-evalverdict-evidence/` -- directory of screenshots, HTTP captures, CLI transcripts
- Returned to caller: `PASS | WARN | FAIL` + path to verdict file + generator feedback summary

### Memory Write

After each completed evaluation, appends a summary line to `.claude/memory/review-patterns.md`:

```
| {date} | {artifact-id} | {verdict: PASS/WARN/FAIL} | {top-criterion} | {score} |
```

This persists evaluation patterns across sessions for `mk:elicit` and `mk:review` to reference.

## Common Use Cases

- Grading a generator-built frontend against the product spec before shipping
- Behavioral QA of a running API against the `backend-api` rubric
- Validating a CLI tool's help output, exit codes, and error handling
- Design quality audit: checking for AI slop signatures (purple gradient, Playfair Display, unDraw illustrations)
- Iteration loop: generator builds, evaluator grades, generator fixes based on feedback

## Pro Tips

- **Don't grade source code** -- that's `mk:review`'s job. If you find yourself reading `.tsx` files instead of clicking buttons, you've drifted into static review.
- **Don't trust test pass claims** -- tests can pass against mocks while the real endpoint 500s. Run the build yourself.
- **Don't auto-load all 7 rubrics** -- `frontend-app` preset is pruned to 4. Loading the others duplicates work `mk:review`/security-rules/qa already do.
- **Don't issue PASS without evidence** -- the validator will reject it and convert to FAIL. Save yourself the round-trip.
- **Don't skip the skeptic persona reload** -- leniency drift is the dominant evaluator failure mode.
- **Slug consistency is critical** -- step-01 determines the slug; step-04 reads `MEOWKIT_EVAL_SLUG` rather than re-deriving it. Drift between the two corrupts evidence-citation relative paths.
- **Hard cap of 15 criteria** -- if the rubric composition produces more, split into batches. If more than 3 batches needed, escalate to user.
