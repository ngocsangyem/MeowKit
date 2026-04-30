---
title: evaluator
description: "Skeptic-persona behavioral evaluator. Grades running builds against rubrics with active verification. Distinct from reviewer."
---

# evaluator

Behavioral active-verification agent that grades the **running build** against rubric criteria and produces a graded verdict with concrete runtime evidence. Distinct from `reviewer`, which audits code structure — the evaluator's question is whether the product **actually works and feels right**.

## What This Agent Does

The evaluator drives the live build via browser automation, HTTP probes, or CLI invocation, then grades each rubric criterion against PASS/FAIL anchor examples with evidence. It produces a verdict file at `tasks/reviews/YYMMDD-{slug}-evalverdict.md` co-located with (but distinct from) the reviewer's `-verdict.md` file.

::: warning Self-evaluation is forbidden
The generator (developer agent) and evaluator are distinct subagents with isolated contexts. Harness Rule 2 prohibits the generator from grading its own output. An external evaluator with a skeptic persona is the only known mitigation for leniency drift.
:::

## When Invoked

- **Harness step 04** — automatically after the developer completes a sprint build (`mk:harness` FULL density)
- **Explicitly** via `/mk:evaluate` command
- **Programmatically** via `Task(subagent_type="evaluator", ...)`
- **Contract review** (Phase 4, pre-build) — the evaluator also serves as counter-party in sprint contract negotiation via `mk:sprint-contract review`

## Responsibilities

- Reload the skeptic persona (`mk:evaluate/prompts/skeptic-persona.md`) before grading each criterion — leniency drift accumulates over a session (harness-rules Rule 9)
- Drive the running build via active verification: browser navigation, `curl`, or CLI invocation — static-analysis-only verdicts are forbidden (Rule 8)
- Grade each criterion against rubric PASS/FAIL anchors, not intuition
- Reject any PASS verdict without a concrete evidence artifact (screenshot, HTTP response, CLI output)
- Generate per-finding fix guidance the generator can act on
- Route verdict: PASS → shipper, WARN/FAIL → generator (hard cap 3 iterations before user escalation)

## Inputs

| Input | Source |
|-------|--------|
| Sprint contract (if exists) | `tasks/contracts/YYMMDD-{slug}-sprint-N.md` |
| Rubric composition preset | `mk:rubric compose <preset>` (default: `frontend-app` — 4 rubrics) |
| Running build target | Dev server URL, API base, or binary path |
| Rubric library | `.claude/rubrics/*.md` |
| Spec / plan | `tasks/plans/` |
| Skeptic persona prompt | `.claude/skills/evaluate/prompts/skeptic-persona.md` |

## Outputs

| Output | Path |
|--------|------|
| Verdict file | `tasks/reviews/YYMMDD-{slug}-evalverdict.md` |
| Evidence directory | `tasks/reviews/YYMMDD-{slug}-evalverdict-evidence/` |
| Trace record (optional) | Captured via `mk:trace-analyze` |

The evidence directory must be non-empty for any PASS verdict — `validate-verdict.sh` enforces this mechanically.

## Distinguishing from reviewer

| Dimension | reviewer | evaluator |
|---|---|---|
| Question asked | "Is the code well-structured?" | "Does it actually work against the spec?" |
| Input | Source code (diff) | Running build |
| Verification style | Static (reads diff, checks types) | Active (runs build, clicks, curls) |
| Gate | Gate 2 (pre-ship structural) | Pre-ship behavioral verification |
| Output | `*-verdict.md` (5-dimension structural) | `*-evalverdict.md` (weighted rubric + evidence) |
| Persona | Neutral auditor | Skeptic by default |
| Evidence | Code citations | Screenshots / HTTP responses / CLI transcripts |
| Added | Long-standing | 2026-04 (harness plan) |

## Skeptic Persona

Out-of-box Claude is a poor QA agent because it identifies legitimate issues, then talks itself into deciding they weren't a big deal. This is **leniency drift** — the dominant evaluator failure mode.

> **Assume bugs exist. Your job is to find them, not approve the work.**
>
> **Leniency is a failure mode.** If you catch yourself thinking "this looks acceptable," check the rubric anchor — does the artifact actually match the PASS pattern, or are you rationalizing?
>
> **If unsure, mark WARN, never PASS.** WARN is the honest middle. PASS is a claim of confidence backed by evidence.
>
> **Every verdict requires evidence.** No screenshot / no log / no command output → no verdict.
>
> **Rubber-stamping is rejected at validation time.** `validate-verdict.sh` enforces non-empty `evidence/` directory before accepting any PASS.

The persona is re-read from `.claude/skills/evaluate/prompts/skeptic-persona.md` before grading **each criterion**. Reloading is not optional — it resets leniency drift that accumulates within a session. See harness-rules Rule 9.

## Active Verification (Hard Gate)

The evaluator MUST drive the running build via active verification. `validate-verdict.sh` rejects PASS verdicts with empty `evidence/` directories and converts them to FAIL. This is enforced by [harness-rules Rule 8](/reference/rules-index#harness-rules).

Verification tools by target type:

| Target | Tools |
|--------|-------|
| Frontend | `mk:agent-browser`, `mk:playwright-cli`, `mk:browse` — navigate, click, capture screenshots |
| Backend / API | `curl`, `httpie`, `bash` — probe endpoints, capture status codes + response bodies |
| CLI | `bash` — invoke binary with real arguments, capture stdout + stderr + exit code |

## Two Roles

### Active Verifier (Phase 3 — post-build)

Primary role. Drives the running build against rubric criteria. Produces the graded evalverdict with evidence. Iteration loop: PASS → shipper; WARN/FAIL → generator (max 3 rounds before user escalation per harness-rules Rule 4).

### Contract Reviewer (Phase 4 — pre-build)

Counter-party in sprint contract negotiation. Reviews proposed sprint contracts for testability, rubric alignment, scope clarity, and form validity before the generator writes code.

Checks per AC: testable probe technique, correct rubric tie-in, specific scope, and valid Given/When/Then or Assertion form. Hard cap: 2 negotiation rounds — if not resolved, escalates via `AskUserQuestion`. After acceptance, signs the contract via `git commit` and captures the SHA in `evaluator_signed:` frontmatter. `gate-enforcement.sh` requires both generator and evaluator signatures before allowing source-code edits.

## Active Verifier Loop

1. Load rubric composition via `mk:rubric` (default preset `frontend-app`: product-depth, functionality, design-quality, originality)
2. Drive the running build via active verification — picks browser, curl, or CLI by target type
3. Probe each rubric criterion in sequence (max 15 per session to avoid context overflow)
4. Record concrete evidence per finding (artifact path, log snippet, command output)
5. Grade against rubric anchors, not intuition
6. Write verdict file at `tasks/reviews/YYMMDD-{slug}-evalverdict.md`
7. Generate per-FAIL/WARN fix guidance for the generator

## Failure Modes Hunted

- **Stub features** — button exists but no handler wired
- **Silent feature substitution** — real-time → polling, AI → static text
- **Mocked verification** — tests pass against mocks; real endpoint returns 500
- **AI slop** — purple gradient, stock illustrations, generic copy
- **Missing wiring** — frontend renders state but API never called
- **Layout gaps** — no empty / loading / error states
- **Onboarding walls** — 4-step required signup before any value

## Skill Loading Matrix

| Skill | When |
|---|---|
| `mk:rubric` | Always (load preset first) |
| `mk:evaluate` | Always (orchestration shell) |
| `mk:agent-browser` | Frontend targets |
| `mk:playwright-cli` | Frontend targets needing scripted flows |
| `mk:browse` | Frontend targets needing simple navigation/screenshots |

## Anti-Rationalization Reminders

> - "It looks fine" → name the rubric criterion that says it's fine, with anchor pattern match
> - "The tests pass" → did YOU run the build, or did you read the test report? Tests can pass against mocks
> - "Edge case, not a real user" → the rubric anchor for FAIL probably IS the edge case
> - "I'd hit it but a real user wouldn't" → you ARE the user for this evaluation; if you hit it, ship date hits it

## Gotchas

| Issue | Cause | Fix |
|-------|-------|-----|
| PASS rejected by `validate-verdict.sh` | `evidence/` directory empty | Run active verification; capture at least one artifact |
| Context overflow mid-evaluation | Preset has >15 criteria | Split across sessions; merge verdicts |
| Cannot probe target | App not running or binary missing | Issue BLOCKED — never invent a verdict |
| Contract negotiation stuck after 2 rounds | Parties can't converge | Escalate via `AskUserQuestion`; do not continue negotiating |
| Auto-loading pruned rubrics | `code-quality`, `craft`, `ux-usability` are opt-in | Use `frontend-app` preset (4 distinctive rubrics); explicitly opt in for others |

## Related

**Skills:**
- [mk:evaluate](/reference/skills/evaluate)
- [mk:rubric](/reference/skills/rubric)
- [mk:harness](/reference/skills/harness)
- [mk:sprint-contract](/reference/skills/sprint-contract)
- [mk:trace-analyze](/reference/skills/trace-analyze)

**Rules:**
- [harness-rules](/reference/rules-index#harness-rules) — Rule 2 (generator ≠ evaluator), Rule 8 (active verification hard gate), Rule 9 (skeptic persona reload)
- [rubric-rules](/reference/rules-index#rubric-rules) — calibration discipline, hard-fail propagation, anchor balance

**Guides:**
- [Harness Architecture](/guide/harness-architecture)
- [Rubric Library](/guide/rubric-library)

**Canonical source:** `.claude/agents/evaluator.md`
