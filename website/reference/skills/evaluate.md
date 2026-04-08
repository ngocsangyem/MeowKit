---
title: "meow:evaluate"
description: "Behavioral active verification — drives a running build via browser/curl/CLI, grades it against rubric criteria with concrete evidence, and produces a graded verdict."
---

# meow:evaluate

Step-file workflow that drives a running build behaviorally, probes each rubric criterion via active verification, and produces a graded verdict with runtime evidence. Distinct from [`meow:review`](/reference/skills/review) (structural code audit). Owned by the `evaluator` agent with isolated context — self-evaluation is forbidden.

## What This Skill Does

`meow:evaluate` takes a running build — a URL, a file path, or a running-app handle — and grades it against a composed rubric preset. The evaluator does not read source code; it clicks buttons, sends HTTP requests, and runs CLI commands to verify each acceptance criterion against the live artifact. Every verdict must include non-empty evidence (screenshot, HTTP response capture, or CLI transcript). PASS verdicts without evidence are rejected by `validate-verdict.sh` and converted to FAIL. The skeptic persona is reloaded before every criterion to prevent leniency drift.

## What This Skill Does NOT Do

`meow:evaluate` is not `meow:review`. The difference matters:

| Dimension | `meow:evaluate` | `meow:review` |
|---|---|---|
| Input | Running build (URL / process) | Source code files |
| Method | Browser, curl, CLI — active | Static analysis — passive |
| Output | Behavioral verdict with evidence | Structural verdict with annotations |
| Persona | Skeptic — find what breaks | Auditor — find what violates standards |
| When | After Phase 3 (build), before ship | After Phase 3, before ship (separate pass) |

Both run before ship. Neither replaces the other.

## Core Capabilities

- **Active verification gate** — every PASS requires evidence in `tasks/reviews/{slug}-evalverdict-evidence/`; validator auto-converts empty-evidence PASS to FAIL
- **Skeptic persona** — loaded from `prompts/skeptic-persona.md` at session start; re-anchored before each criterion to prevent leniency drift
- **Rubric composition** — composes the active preset via `meow:rubric`; frontend-app default is pruned to 4 rubrics (product-depth, functionality, design-quality, originality)
- **Sprint contract integration** — loads signed contract criteria in step-01 if a contract exists for the task
- **Max 15 criteria per session** — splits into multiple sessions if the composed rubric exceeds this; context overflow threshold from research-01 §4
- **Generator feedback** — produces one-line fix guidance per FAIL/WARN criterion for the harness iteration loop
- **Hard-fail propagation** — any rubric at its `hard_fail_threshold` → overall verdict is FAIL regardless of weighted score

## When to Use This

::: tip Use meow:evaluate when...
- A generator iteration has completed and the harness needs a graded verdict
- You want to verify a running app against its spec, not just its code
- You're grading a frontend or fullstack product after Phase 3 (build)
- You want behavioral evidence before deciding whether to ship
:::

::: warning Don't use meow:evaluate when...
- The build has no runnable artifact (pure library, type-only package) — nothing to actively probe
- You want structural code review — use [`meow:review`](/reference/skills/review) for that
- The task is `/meow:fix` simple — overhead exceeds value for tiny changes
- You're tempted to read `.tsx` files instead of clicking buttons — that means you've drifted into static review
:::

## Usage

```bash
# Evaluate a running dev server
/meow:evaluate http://localhost:3000

# Evaluate with an explicit rubric preset
/meow:evaluate http://localhost:3000 --rubric-preset fullstack-product

# Evaluate a CLI tool by path
/meow:evaluate ./dist/my-cli --rubric-preset cli-tool

# Cap criteria per session (useful for large presets)
/meow:evaluate http://localhost:3000 --max-criteria 10

# Harness invokes evaluate automatically after step-03-generate
# (internal invocation — no manual flag needed in that context)
```

## Workflow

```
Step 1: Load Rubrics    → compose preset, load skeptic persona, parse sprint contract if exists
Step 2: Boot App        → start the build if not already running (skip if URL given)
Step 3: Probe Criteria  → drive browser/curl/CLI per criterion; capture evidence
Step 4: Grade & Verdict → score each rubric; write verdict file; run validate-verdict.sh
Step 5: Gen Feedback    → produce one-line fix guidance per FAIL/WARN; emit handoff message
```

## Inputs

- Target URL, file path, or app handle (positional argument)
- `--rubric-preset frontend-app|backend-api|cli-tool|fullstack-product` — rubric composition preset
- `--max-criteria N` — max criteria to grade per session (default 15)
- `tasks/contracts/{date}-{slug}-sprint-{N}.md` — signed contract (loaded if present; gates on `contract_schema_version:` marker)
- `prompts/skeptic-persona.md` — persona fragment loaded at step-01 and re-anchored per criterion

## Outputs

- `tasks/reviews/YYMMDD-{slug}-evalverdict.md` — structured verdict (YAML frontmatter + per-rubric sections)
- `tasks/reviews/YYMMDD-{slug}-evalverdict-evidence/` — screenshots, HTTP response captures, CLI transcripts
- Returned to caller: `PASS | WARN | FAIL` + verdict file path + generator feedback summary

## Verdict Schema

Frontmatter fields in the verdict file:

```yaml
---
task: {slug}
evaluator_run: {YYMMDD-HHMM}
rubric_preset: frontend-app
model: claude-opus-4-6
overall: PASS | WARN | FAIL
weighted_score: 0.88
hard_fail_triggered: false
iterations: 1
---
```

## Flags

| Flag | Purpose | Default |
|---|---|---|
| `--rubric-preset <name>` | Rubric composition preset | `frontend-app` |
| `--max-criteria N` | Criteria cap per session | `15` |

## How It Works

### Step 1 — Load Rubrics

Calls `meow:rubric compose <preset>` to assemble grading criteria. Loads `prompts/skeptic-persona.md`. Parses the signed sprint contract if one exists for the task (gates on `contract_schema_version:` marker — unversioned contracts are ignored until Phase 4 ships).

### Step 2 — Boot App

If a file path was given instead of a URL, starts the build process and waits for a healthy port. Skips this step if a URL is provided directly.

### Step 3 — Probe Criteria

For each criterion in the composed rubric: re-anchor skeptic persona, drive the app (browser navigation, `curl`, or CLI invocation), capture evidence. Evidence is saved to the `evidence/` directory. Evidence types: screenshot (`.png`), HTTP response capture (`.txt`), CLI stdout+exit-code transcript (`.txt`).

### Step 4 — Grade and Verdict

Scores each rubric against its PASS/WARN/FAIL definitions. Checks anti-pattern list. Applies hard-fail propagation. Writes the verdict file. Runs `validate-verdict.sh` — PASS with empty evidence directory is converted to FAIL.

### Step 5 — Generator Feedback

For each FAIL or WARN criterion, produces a one-line fix suggestion scoped to the active rubric. Emits a handoff message for the harness iteration loop (consumed by step-05-iterate-or-ship in `meow:harness`).

## Hard Constraints

From `harness-rules.md` Rules 8–9:
1. Active verification gate — PASS verdict without non-empty `evidence/` directory is rejected; `validate-verdict.sh` converts it to FAIL
2. Skeptic persona must be re-anchored before grading each criterion — not once per session
3. Evaluator owns `tasks/reviews/*-evalverdict.md` only — never modifies source files
4. Max 15 criteria per session — split into multiple sessions if rubric composition exceeds
5. Frontend-app preset is pruned to 4 rubrics (Phase 2 v2.0.0 audit) — other 3 are opt-in

## Gotchas

1. **Don't grade source code** — if you're reading `.tsx` files instead of clicking buttons, you've drifted into static review; that's `meow:review`'s job
2. **Don't trust test-pass claims** — tests can pass against mocks while the real endpoint returns 500; run the build yourself
3. **Don't auto-load all 7 rubrics** — the pruned 4-rubric frontend preset avoids duplicating work that `meow:review` and `security-rules.md` already cover
4. **Don't issue PASS without evidence** — the validator will reject it and convert it to FAIL; save yourself the round-trip
5. **Don't skip the skeptic persona reload** — leniency drift is the dominant evaluator failure mode per research-01 §6; re-anchoring is the only known mitigation
6. **Don't evaluate if no runnable artifact exists** — pure libraries or type-only packages have nothing to actively probe

## Relationships

- [`meow:harness`](/reference/skills/harness) — step 4 of the harness pipeline; invokes `meow:evaluate` after each generator iteration
- [`meow:rubric`](/reference/skills/rubric) — provides the composed rubric presets used for grading
- [`meow:sprint-contract`](/reference/skills/sprint-contract) — signed contract is loaded in step-01 to scope grading to negotiated criteria
- [`meow:review`](/reference/skills/review) — structural code audit; distinct from and complementary to behavioral evaluation
- [`meow:trace-analyze`](/reference/skills/trace-analyze) — consumes evaluator verdict records from `trace-log.jsonl` for pattern analysis
- [`/reference/agents/evaluator`](/reference/agents/evaluator) — the evaluator agent persona this skill orchestrates

## See Also

- Canonical source: `.claude/skills/meow:evaluate/SKILL.md`
- Active verification patterns: `.claude/skills/meow:evaluate/references/active-verification-patterns.md`
- Skeptic persona: `.claude/skills/meow:evaluate/prompts/skeptic-persona.md`
- Related skills: [`meow:harness`](/reference/skills/harness), [`meow:rubric`](/reference/skills/rubric), [`meow:trace-analyze`](/reference/skills/trace-analyze)
- Governing rules: `harness-rules.md` Rules 8–9, `rubric-rules.md`
