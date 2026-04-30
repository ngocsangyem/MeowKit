# Harness Runbook

User-facing guide to running `/mk:harness` for autonomous multi-hour product builds.

## What Is the Harness

`mk:harness` is meowkit's autonomous build pipeline. You describe a green-field product in plain English ("build me a kanban app", "make a retro game maker") and the harness orchestrates planner → contract → generator → evaluator → ship without manual handholding.

It's distinct from `mk:cook`:

| Use `/mk:cook` for | Use `/mk:harness` for |
|---|---|
| Single feature | Whole product / app |
| Bug fix | Green-field build |
| Refactor | "Build me a X" prompts |
| Doc update | Multi-hour autonomous run |

## Quick Start

```bash
/mk:harness "build a kanban app"
```

The harness picks the right scaffolding density based on your model tier and runs the full pipeline.

## Flags

| Flag | Default | Purpose |
|---|---|---|
| `--tier auto\|minimal\|full\|lean` | `auto` | Override the auto-detected scaffolding density |
| `--max-iter N` | `3` | Max generator/evaluator iteration rounds before escalation |
| `--budget USD` | `50` | Hard cap on total run cost (overrides default $100 hard block) |
| `--no-boot` | (off) | Skip the boot-app step (target must be a running URL) |
| `--teams` | (off) | Use Agent Teams for live generator↔evaluator coupling |
| `--resume RUN_ID` * | — | Resume a killed run from the last completed step *(partial in v1.0 — may require `MEOWKIT_HARNESS_RESUME_STEP=N`; see Limitations)* |

## Density Modes

The harness scales scaffolding to model capability per the dead-weight thesis:

| Mode | Tier | What runs |
|---|---|---|
| **MINIMAL** | TRIVIAL (Haiku) | Short-circuits to `mk:cook`. No contract, no iteration. |
| **FULL** | STANDARD (Sonnet), COMPLEX (Opus 4.5) | Full pipeline: contract required, 1–3 iteration rounds, context resets between steps. |
| **LEAN** | COMPLEX (Opus 4.6+) | Single-session: contract optional, 0–1 iteration, no context reset. Trusts the model's adaptive reasoning. |

**Override:** `export MEOWKIT_HARNESS_MODE=LEAN` (or `FULL` / `MINIMAL`) to force a mode.

**Auto-detection:** the harness reads `MEOWKIT_MODEL_HINT`, then `CLAUDE_MODEL`, then `ANTHROPIC_MODEL`. If none are set, defaults to STANDARD/FULL (safe fallback). Opus 4.6 users who want LEAN should either set `MEOWKIT_MODEL_HINT=opus-4-6` or pass `--tier lean` explicitly.

## What to Expect

| Density | Wall-clock target | Cost target |
|---|---|---|
| MINIMAL | < 5 min | < $1 |
| LEAN | < 30 min | < $15 |
| FULL | 1–3 hours | $20–$50 |

**Hard limits:**
- 6-hour wall-clock timeout (run halts and writes a final report regardless)
- $100 default hard block (can be overridden with `--budget`)

## Artifacts

Every run writes:

```
tasks/harness-runs/{YYMMDD-HHMM-slug}/
└── run.md                              ← audit trail (frontmatter + per-step sections)

tasks/plans/{date-slug}/plan.md          ← product-level spec from step-01
tasks/contracts/{...}-sprint-1.md        ← sprint contract from step-02 (if FULL)
tasks/handoff/{slug}-sprint-1.md         ← generator handoff from step-03
tasks/reviews/{date-slug}-evalverdict.md ← graded verdict from step-04
tasks/reviews/{date-slug}-evalverdict-evidence/  ← screenshots/curl/CLI captures
```

After the run, the audit trail at `run.md` shows: density decision, per-step artifacts, budget trail, iteration history, and final status.

## Verdict Outcomes

| `final_status` | Meaning | Next action |
|---|---|---|
| `PASS` | Evaluator graded everything passing; ship | Auto-routes to shipper agent |
| `WARN` | Some criteria warned but no hard fails; ship with notes | Auto-routes to shipper |
| `FAIL` | Hard fail on at least one rubric; iteration loop | Loops back to generator with feedback |
| `ESCALATED` | FAIL after max iterations; human escalation | AskUserQuestion presents 3 choices |
| `TIMED_OUT` | 6h wall-clock OR budget breach | Halts; user investigates the run.md trail |

## Troubleshooting

### "Density auto-detected as FULL but I'm on Opus 4.6"

The harness couldn't detect your model. Set the env var:

```bash
export MEOWKIT_MODEL_HINT=opus-4-6
```

OR pass the flag:

```bash
/mk:harness "build X" --tier lean
```

### "Budget breach at iteration 2"

The cost tracker blocked at $100 (or your `--budget`). Read `tasks/harness-runs/{run-id}/run.md` "Budget Trail" section to see which step burned the most. Common causes:
- Iteration loop oscillating (fix-introduces-new-fail)
- Generator over-iterating in step-03 (verify the self-eval checklist isn't being skipped)
- Evaluator probing too many criteria (cap is 15; rubric composition may be too large)

### "Evaluator returned FAIL but the build looks fine to me"

Read the evidence files at `tasks/reviews/{date}-{slug}-evalverdict-evidence/`. The evaluator captures screenshots/HTTP responses/CLI output. If the evidence shows real failures, fix them. If the evidence shows the evaluator misread, the rubric anchor may need recalibration — file a follow-up plan.

### "The contract negotiation hit round 3"

Two agents couldn't converge on a testable spec in 2 rounds. The harness escalates to you. Common causes:
- The product spec has irreducible ambiguity (the user prompt was vague)
- The rubric preset doesn't match the project type
- One AC is genuinely unverifiable

Fix the product spec OR explicitly skip the contract via `MEOWKIT_HARNESS_MODE=LEAN`.

### "I want to resume a killed run"

```bash
/mk:harness --resume {run-id}
```

The harness reads `tasks/harness-runs/{run-id}/run.md` to find the last completed step and continues from there. Iteration counter is durable in the frontmatter; cost trail is in `cost-log.json`.

## Token Savings (Phase 9 — Conversation Summary Cache)

Long harness runs accumulate context fast. The `conversation-summary-cache.sh` hook keeps a Haiku-summarized snapshot of the running conversation at `.claude/memory/conversation-summary.md` and re-injects it on every new turn — instead of forcing the model to re-read the full transcript.

**How it works:**

- On `Stop` (turn complete) the hook checks throttle: transcript > 20KB AND (≥5 turns OR ≥5KB growth since last summary)
- If throttled, it tails the last 500 transcript lines, pipes them through `claude -p --model haiku`, scrubs secrets, and atomically writes the cache
- On `UserPromptSubmit` (next turn) it emits the cached summary as a `## Prior conversation summary` block (capped at 4KB) before the model sees the new prompt

**Math (typical 50-turn harness session):**

| Item | Without cache | With cache |
|---|---|---|
| Per-turn re-read of transcript | ~48 KB | ~4 KB (cached summary) |
| Total context burn over 50 turns | ~2.4 MB | ~200 KB |
| Summarization cost (Haiku, throttled) | $0 | ~$0.01–$0.02 |
| Net token savings per long session | — | ~90% reduction in transcript replay |

**Tuning:**

```bash
export MEOWKIT_SUMMARY_CACHE=off              # disable entirely
export MEOWKIT_SUMMARY_THRESHOLD=40960         # raise to 40KB minimum transcript
export MEOWKIT_SUMMARY_TURN_GAP=10             # summarize at most every 10 turns
export MEOWKIT_SUMMARY_GROWTH_DELTA=10240      # require 10KB growth between summaries
```

**Inspecting the cache:** the cache is a plain markdown file. Open `.claude/memory/conversation-summary.md` at any time to see what the agent will inject on the next turn. Edit it manually if a summary went off-rails — the hook re-generates only when throttle triggers.

**Graceful degradation:** if `claude` CLI is missing or summarization fails, the hook exits 0 silently and the session proceeds with full transcript re-reads. Zero blast radius.

## Limitations

- **Cannot judge audio** — no audio analysis in the rubric library yet
- **Cannot judge highly subjective taste** without rubric anchors — if the project has unique aesthetic constraints, write a custom rubric
- **Cannot execute closed-source binaries** — the active-verification gate needs source-runnable build
- **`--resume` is partial in v1.0** — iteration counter resumes correctly, but step entry-point detection is manual; you may need to set `MEOWKIT_HARNESS_RESUME_STEP=N` to skip already-completed steps

## See Also

- `.claude/skills/harness/SKILL.md` — full skill specification
- `.claude/skills/harness/references/adaptive-density-matrix.md` — density decision matrix
- `.claude/skills/harness/references/agent-teams-vs-subagents.md` — when to use `--teams`
- `docs/dead-weight-audit.md` — playbook for keeping the harness pruned
- `.claude/rules/harness-rules.md` — discipline core
