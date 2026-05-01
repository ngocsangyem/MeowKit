---
title: Session State vs Claude Code --resume
description: How MeowKit's session-state layer differs from Claude Code's built-in --resume mechanism. They share a trigger word but operate at different layers and solve different problems.
persona: B
---

# Session State vs Claude Code `--resume`

MeowKit's `session-state/` directory and Claude Code's built-in `--resume` flag share a trigger word ("session") but operate at different layers and solve different problems. **They are complementary, not redundant.** This page exists because the question keeps coming up, and the right framing prevents wrong cleanup.

## TL;DR

| | Claude Code `--resume` | MeowKit `session-state/` |
|---|---|---|
| **What it restores** | Conversation transcript (messages + tool calls) | Hook-layer enforcement state |
| **Operates at** | Protocol / dialogue layer | Hook / runtime-policy layer |
| **Knows about** | What was said | What the process is allowed to do next |
| **Cannot restore** | Hook counters, build-skip caches, environment drift | Conversation context (the model derives that from `--resume`) |

`--resume` restores **what the model knows**. Session-state controls **what the model is allowed to do next**. Both are needed; neither replaces the other.

## The categorical error

The natural framing is "redundant or complementary?" That framing is wrong. It assumes both systems answer the same question. They don't.

- **Claude Code's `--resume`** is a *conversation replay* mechanism. It reconstructs *what was said*. It has no opinion about what state the filesystem is in, whether a doom-loop guard should fire, or how many edits happened. It is a transcript.
- **MeowKit's `session-state/`** is a *workflow enforcement* layer. It tracks *what the process did* — not what was said, but what was *executed*: build attempts, budget consumed, loop counters, model identity, stop-gate re-entries. These are behavioral guardrails, not memory.

Different nouns wearing the same word. Claude Code's "session" is a *dialogue*. MeowKit's "session" is a *unit of workflow execution*. The right axis is **convo-layer vs enforcement-layer**, not redundant vs complementary.

::: tip Reframe
The real question isn't "is session-state redundant?" The real question is: **"If `--resume` restores conversation context, what restores behavioral constraints?"** Answer: nothing in Claude Code does. That's the gap MeowKit fills.
:::

## Four things `session-state/` enables that `--resume` cannot

These are the concrete capabilities that make session-state load-bearing — capabilities that pure transcript replay cannot reconstruct.

### 1. Pre-model policy enforcement

`loop-detection.cjs` reads `edit-counts.json` on every `PostToolUse` event. If a single file has been edited beyond threshold (≥4 = warn, ≥8 = escalate), the hook emits `@@LOOP_DETECT_WARN@@` or `@@LOOP_DETECT_ESCALATE@@` **before the model receives the tool result**. The model never sees a clean continuation.

Transcript replay cannot do this. It informs after the fact; hook state *gates*.

### 2. Hook composition as a shared bus

Five handlers cross-read each other's state:

- `budget-tracker.cjs` reads `detected-model.json` to select per-tier pricing
- `auto-checkpoint.cjs` reads both `budget-state.json` and `detected-model.json` to stamp the checkpoint
- `checkpoint-writer.cjs` reads `active-plan` and `budget-state.json` at Stop
- `loop-detection.cjs` writes counters that other observers read
- `pre-completion-check.sh` reads `precompletion-attempts.json` to enforce the 3-attempt re-entry cap

This is an **integration bus**, not a log. No transcript carries this coordination — handlers are isolated subprocesses with no shared memory; the filesystem IS the coordination layer.

### 3. Hash-based build-skip cache

`build-verify.cjs` computes a content hash of the edited file, compares against `build-verify-cache.json`, and skips `tsc --noEmit` / `eslint` on unchanged files (`build-verify.cjs:86-88` returns early on cache hit). Deterministic, content-addressed, side-effect-free.

Transcript replay has no mechanism to suppress redundant side-effect execution. The model would have to remember "I already typechecked this file" — but the cache makes the suppression mechanical.

### 4. Adaptive harness density per model tier

`detected-model.json` carries `tier` (TRIVIAL/STANDARD/COMPLEX) and `density` (MINIMAL/FULL/LEAN). Every downstream hook reads this:

- Cheaper Haiku sessions get MINIMAL density (the harness short-circuits to `mk:cook`)
- Sonnet / Opus 4.5 get FULL density (sprint-contract gate, multi-iteration evaluator)
- Opus 4.6+ get LEAN density (single-session, optional contract, 0–1 iterations) — capable models DEGRADE under full scaffolding per the dead-weight thesis

Transcript replay is tier-blind. It cannot drive hook policy.

## What DOES survive `--resume`

A common over-claim is that the two layers are "fully orthogonal." That's too clean. Some behavioral context survives `--resume` because it's stored in **project files** that Claude Code re-reads at session start:

| Survives `--resume`? | What | Where |
|---|---|---|
| ✓ Yes | Behavioral rules (security, injection, gates) | `CLAUDE.md`, `.claude/rules/*.md` |
| ✓ Yes | Skill content | `.claude/skills/**/SKILL.md` |
| ✓ Yes | Agent definitions | `.claude/agents/*.md` |
| ✓ Yes | Project context | `docs/project-context.md` |
| ✗ No | Edit counters (doom-loop) | `session-state/edit-counts.json` |
| ✗ No | Build-skip cache | `session-state/build-verify-cache.json` |
| ✗ No | Stop-gate re-entry counter | `session-state/precompletion-attempts.json` |
| ✗ No | Live budget accumulator | `session-state/budget-state.json` |
| ✗ No | Model tier + density | `session-state/detected-model.json` |
| ✗ No | Git drift (last commit hash) | `session-state/checkpoints/checkpoint-latest.json` |

The gap MeowKit fills is **specifically the runtime-policy state** — counters, caches, hashes, drift — that lives in files Claude Code does not load.

## File-by-file map

For each session-state file, here is what it does and why `--resume` cannot replace it.

| File | Writer | Reader | Why session-state, not `--resume` |
|---|---|---|---|
| `budget-state.json` | `budget-tracker.cjs` (PostToolUse) | Same handler + `auto-checkpoint`, `checkpoint-writer`, `post-session.sh` | Live token/cost counter. Each write IS an enforcement action — `budget-tracker` returns `@@BUDGET_BLOCK@@` over cap. |
| `detected-model.json` | `model-detector.cjs` (SessionStart) | `budget-tracker`, `auto-checkpoint`, `checkpoint-writer` | Model tier drives hook density. Set from SessionStart `model` field. |
| `edit-counts.json` | `loop-detection.cjs` (PostToolUse Edit/Write) | Same handler | Doom-loop guard. Keyed by `{session_id}:{realpath}`. |
| `precompletion-attempts.json` | `pre-completion-check.sh` (Stop) | Same hook | 3-attempt re-entry cap on Stop verification gate. |
| `build-verify-cache.json` | `build-verify.cjs` (PostToolUse) | Same handler | Hash-based skip cache for compile/lint. |
| `learning-observer.jsonl` | `learning-observer.sh` (PostToolUse) | `post-session.sh` (Stop) | Append-log for churn detection input. |
| `last-session-id` | `project-context-loader.sh` (SessionStart) | Same hook (new-session detection) | Detects when the session_id has changed (Claude Code starts a fresh session vs resumes the same one). |
| `checkpoints/checkpoint-latest.json` | `checkpoint-writer.cjs` (Stop) + `auto-checkpoint.cjs` (phase transitions) | `orientation-ritual.cjs` (SessionStart resume) | Single-file resume context: model tier, density, plan path, git state, budget. v2.7.2 collapsed this from the prior pointer-and-numbered-file scheme. |

::: details Lifecycle
Most session-state files are wiped by `project-context-loader.sh` on session-id change (when `last-session-id` differs from the current session). Inside a single session, they accumulate. The `checkpoints/` directory holds the *current* checkpoint; `cost-log.json` (durable, in `.claude/memory/`) holds the *historical* per-session aggregate.
:::

## When to use which mental model

| Question you're asking | Layer to think about |
|---|---|
| "What was said in the last conversation?" | `--resume` (transcript) |
| "What was the agent doing when the session ended?" | `session-state/checkpoints/` (resume context) |
| "Has the agent been editing the same file too many times?" | `session-state/edit-counts.json` (loop guard) |
| "Did this session go over budget?" | `session-state/budget-state.json` (live) + `.claude/memory/cost-log.json` (historical) |
| "Which model tier is this session running on?" | `session-state/detected-model.json` |
| "Has the working directory drifted since last checkpoint?" | `session-state/checkpoints/checkpoint-latest.json` (git hash compare) |
| "What rules and skills apply to this project?" | `CLAUDE.md`, `.claude/rules/`, `.claude/skills/` (loaded by `--resume`) |
| "What was the durable lesson from the last bug fix?" | `.claude/memory/fixes.md` (loaded on demand by `mk:fix`) |

## Honest caveats

The layer is not perfect. A 2026-05-01 council audit flagged three file-level concerns worth follow-up if you ever want to optimize further:

- **`last-session-id`** may overlap with the SessionStart `source` field (`startup` vs `resume` vs `clear`). The two signals are genuinely different (`source` = trigger; `last-session-id` = whether the ID changed), but the overlap is worth a code-level audit before the next refactor.
- **`detected-model.json`** is read from disk by every PostToolUse handler. If `dispatch.cjs` ever evolves to pass shared state through its call chain, the file could be eliminated as an IPC crutch.
- **`learning-observer.jsonl`** has one writer (`learning-observer.sh`) and one reader (`post-session.sh` at Stop). If neither is doing something useful with the data, the log is dead instrumentation.

These are micro-redundancies inside a layer that is genuinely complementary — not reasons to remove the layer.

## Related

- [Memory System](/guide/memory-system) — `.claude/memory/` topic files (durable, human-curated learnings) — distinct from session-state
- [Workflow Phases (0-6)](/guide/workflow-phases) — where each phase reads/writes session-state
- [Adaptive Density](/guide/adaptive-density) — how `detected-model.json` drives the harness
- [Changelog v2.7.2](/changelog#_2-7-2-2026-05-01-checkpoint-subsystem-cleanup) — the single-file checkpoint collapse
