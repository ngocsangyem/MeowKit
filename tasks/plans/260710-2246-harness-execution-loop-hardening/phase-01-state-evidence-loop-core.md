---
phase: 1
title: "State & Evidence Loop Core"
status: pending
effort: "L"
priority: P1
dependencies: []
---

# Phase 1: State & Evidence Loop Core

## Overview

Build the single typed state writer API and the scoped evidence envelope that every later phase consumes. Today the loop `intent → active plan → phase → action → verification → result → resume` is broken at the producer end: `session-state/active-plan.json` and `session-state/verification-required.json` have hook consumers but **no production writer anywhere** — the files currently on disk are leftover test fixtures from `test-pre-completion-check.sh`. This phase is strict TDD (audit §10). **Ships in the same release train as Phase 2** — the verification-required producer activates only together with the Phase 2 gate logic, so the Stop-side gate never goes live before the write-side gate is scoped (red team: mid-rollout asymmetry).

## Key Insights (verified)

- `pre-completion-check.sh:50-53` exits 0 when `verification-required.json` is absent — the Stop verification gate is a no-op today.
- `HOOKS_INDEX.md:74-76` documents `cook`/`autobuild`/`plan-creator` as producers of these files; grep of those skills finds zero write instructions. Docs are aspirational.
- `plan-creator/step-08b-html-render.md:37` explicitly forbids resolving plans from `session-state/active-plan` — the skill deliberately avoids the file it is documented to write.
- **Reusable machinery already exists — build on it, don't duplicate it** (red team): `.claude/hooks/lib/shared-state.cjs` provides generic atomic (tmp+rename) load/save over `session-state/*.json`, injected into every handler via `dispatch.cjs`; `packages/mewkit/src/core/file-lock.ts` is a proven lock primitive (used by `immediate-capture-handler.cjs:11` and `migrate/reconcile/portable-registry-lock.ts`); `wiki/handoff/service.ts:149` shows evidence hashing computed from real content inside the CLI.
- "Active plan" resolution is fragmented three ways today: `session-state/active-plan.json` (reader: pre-completion), legacy `session-state/active-plan`, and `core/find-active-plan.ts` (mtime heuristic driving the orchviz dashboard: `plan-switcher`, `plan-table`, `top-strip`). This phase must converge them, not add a fourth silo.
- Display readers have their own defects: `orchviz/overlay/session-state-readers.ts` reads `session-state/active-phase` (zero writers repo-wide) and expects `modelId` camelCase while `detected-model.json` writes `model_id` — `readModelInfo()` always returns null.
- Checkpoints (`checkpoint-utils.cjs:57-65`) carry only `plan_path`; two writers race last-writer-wins (documented, acceptable for checkpoints only).

## Requirements

- Functional: one writer API for run/plan/verification state; scoped result envelope with **captured** (not self-reported) verification evidence; enriched checkpoint pointers; real producers wired into the plan/build/review skills' instructions; converged active-plan resolution.
- Non-functional: atomic writes via `shared-state.cjs` pattern; mutating read-modify-write operations wrapped with `core/file-lock.ts`; session-scoped state (parallel same-checkout sessions must not clobber each other); schema-versioned JSON; all schemas/messages product-name-free; Markdown plan checkboxes remain canonical; no raw logs injected into context.
- **Runtime dependency rule (red team):** hooks only *read* state files, parsing defensively with fallbacks — they never invoke the CLI at runtime. Writes happen via the CLI called from skills. `doctor` gains a CLI-reachability probe so a flat-copy install without a built CLI degrades visibly, not silently.

## Architecture

```
skills (plan-creator, cook, autobuild, fix, review)
        │  CLI: `state` subcommand (activate-run / set-phase / require-verification / record-result …)
        ▼
packages/mewkit/src/core/session-state/   ← typed writer/reader module (new); locking via core/file-lock.ts
        │  schemas shared with the .cjs runtime (extend .claude/hooks/lib/shared-state.cjs — no parallel module)
        ▼
session-state/runs/<session_id>.json      ← active-run, SESSION-SCOPED (red team: one global file breaks
                                             parallel sessions permitted by parallel-execution-rules.md Rule 6)
                                             {schema_version, run_id, session_id, plan_path, plan_slug,
                                              phase, blockers[], open_decisions[], last_result_ref, updated_at}
session-state/verification-required/<session_id>.json   ← SESSION-SCOPED like runs (a single global file would let
                                             session B's write disarm session A's Stop gate)
                                             {schema_version, required, run_id, session_id, plan_slug, reason, created_at}
tasks/plans/<plan>/results/RESULT-<run_id>.json   (results/ gitignored; retention: keep last N per plan)
                                          ← {schema_version, run_id, session_id, plan_slug, command,
                                             exit_code, artifact_hash, started_at, finished_at,
                                             verdict_ref, trace_ref}
        ▲
consumers: pre-completion-check.sh + gate-enforcement.sh (Phase 2; resolve run via their session_id input),
           checkpoint-writer.cjs, orchviz readers, resume drill
```

**Evidence capture rule (red team, critical):** `state record-result` *executes the verification command itself* (or wraps its execution) and computes `exit_code` and `artifact_hash` from what actually ran — following the `wiki/handoff/service.ts:149` pattern. The CLI never accepts caller-supplied exit codes or hashes; anything else is the "self-reported verification" anti-pattern this plan's Out-of-Scope list forbids.

**Enforcement honesty (red team):** gates consume `run_id`, `plan_slug`, and verification scope only. `phase`, `blockers[]`, `open_decisions[]` are **continuity data** — their consumers are the resume drill, checkpoints, and the dashboard, not enforcement. The backstop claim is scoped accordingly: skipping `activate-run` leaves the session on the truthful weaker gate (Phase 2 wording), and that residual risk is part of the documented threat model in `plan.md`.

**Markdown-wins algorithm (red team — must be deterministic, not aspirational):** canonical progress = phase-file frontmatter `status` fields plus the checkbox counts in `plan.md`'s phase table, parsed by a small shared function (single implementation in `core/session-state/`, exposed to hooks via the shared `.cjs`). If `active-run.phase` disagrees with the derived canonical phase, the run is marked `stale: true` and gates treat it as absent until re-activation. Tests pin the parse on real plan fixtures.

## Related Code Files

- Create: `packages/mewkit/src/core/session-state/` (writer, reader, markdown-derivation, schemas, `__tests__/`), CLI `state` subcommand in `packages/mewkit/src/commands/`.
- Modify: `.claude/hooks/lib/shared-state.cjs` (extend for the new schemas/paths — no new parallel module), `packages/mewkit/src/index.ts` (dispatch + help), `.claude/hooks/lib/checkpoint-utils.cjs` + `handlers/checkpoint-writer.cjs` (pointer enrichment), `.claude/hooks/pre-completion-check.sh` (consume schema-versioned, session-scoped file), `packages/mewkit/src/core/find-active-plan.ts` + its orchviz consumers (`plan-switcher`, `plan-table`, `top-strip`) → active-run-first resolution with mtime fallback, `packages/mewkit/src/orchviz/overlay/session-state-readers.ts` (read active-run; fix `model_id` mismatch; delete orphaned `active-phase` reader), skill instructions in `.claude/skills/plan-creator/`, `cook/`, `autobuild/`, `fix/`, `review/` (mandatory state-CLI calls), `.claude/hooks/HOOKS_INDEX.md` (producers become true), `packages/mewkit/src/commands/doctor*` (CLI-reachability probe), `.gitignore` (`tasks/plans/**/results/`), `.claude/hooks/__tests__/test-pre-completion-check.sh` (fixtures to temp dir).
- Delete: leftover fixture files `session-state/active-plan.json`, `session-state/verification-required.json`; legacy `session-state/active-plan` fallback after producers land.

## Implementation Steps

1. **Tests first:** schema round-trip; atomic write (no partial file on kill); concurrent mutators don't lose appends (file-lock under parallel `addBlocker` calls); schema_version rejection; Markdown-derivation parse on real plan fixtures; conflict → `stale` marking; two sessions activating different runs don't interfere; `record-result` captures real exit codes/hashes from an executed command; producer integration shapes.
2. Implement `core/session-state/`: `activateRun`, `setPhase`, `addBlocker/resolveBlocker`, `recordDecision`, `requireVerification`, `recordResult`, `readActiveRun(sessionId)`, `deriveCanonicalProgress(planDir)` — atomic writes, file-lock on mutation, session-scoped paths.
3. Add `state` CLI subcommand (JSON in/out, exit codes for scripting); extend `shared-state.cjs` so hooks read the same schemas without the CLI; register in `index.ts` help.
4. Implement RESULT capture: `state record-result -- <command…>` runs the command, records exit code, hashes declared output artifacts, writes the envelope under `results/`, updates `last_result_ref`. Gitignore `results/`; prune beyond N per plan.
5. Update `pre-completion-check.sh` to resolve the session's run and parse the new schema defensively (malformed → treated as absent, warning emitted; full gate scoping lands in Phase 2).
6. Wire producers: plan activation (plan-creator terminal step), phase transition + verification-required (cook/autobuild — activation of this producer is release-coupled to Phase 2), result recording (review/verify steps). Each skill gets an explicit, copy-pasteable CLI call — not prose advice.
7. Converge active-plan resolution: orchviz and any `find-active-plan.ts` consumer read active-run first, mtime heuristic only as fallback; remove the legacy no-extension file path.
8. Enrich checkpoints with pointers (`phase`, top `blockers`, `next_action`, `last_result_ref`); checkpoints stay cache-only, last-writer-wins stays acceptable there.
9. Fix orchviz readers (field names, orphaned reader); add `doctor` CLI-reachability probe; move test fixtures to temp dirs; add repo-hygiene check that `session-state/` holds no committed fixtures.
10. Manual kill/resume drill: activate → transition → kill → new session restores plan, phase, blockers, next action from pointers alone (automated in Phase 7).

## Success Criteria

- [ ] The session-scoped verification-required and active-run files each have ≥1 real production producer, exercised by tests (not fixtures); legacy global `verification-required.json` is migrated/removed.
- [ ] `record-result` cannot be fed a fabricated exit code or hash — evidence is captured from real execution (test proves the CLI rejects/ignores caller-supplied values).
- [ ] Two concurrent sessions on one checkout run independent plans without gate interference or lost state mutations.
- [ ] Kill/resume drill restores plan, phase, blockers, next action; Markdown conflict marks the run stale deterministically.
- [ ] Hooks never invoke the CLI; corrupt state files degrade to documented fallback with a warning; `doctor` probes CLI reachability.
- [ ] Orchviz dashboard and gates agree on the active plan (single resolution order).
- [ ] Orphaned `active-phase` reader removed; `readModelInfo()` returns non-null against the real on-disk file.
- [ ] All new schemas/messages contain no product self-references.

## Risk Assessment

- **Producers are prose-executed by the model** (skills can be skipped): Phase 2 gates consume `run_id`/`plan_slug`/verification so skipping producers visibly blocks progress; `phase`/`blockers`/`decisions` are continuity-only by design — documented, not overclaimed.
- **Schema churn breaking hooks:** `schema_version` field + reader tolerance for one prior version.
- **Session-scoped files accumulate:** prune runs older than TTL on SessionStart (same pattern as existing counters); `session-state/` stays a single ephemeral namespace.
- **Release coupling with Phase 2 slips:** verification-required producer ships behind the Phase 2 gate's presence check — if Phase 2 is absent, the producer is inert rather than half-armed.
