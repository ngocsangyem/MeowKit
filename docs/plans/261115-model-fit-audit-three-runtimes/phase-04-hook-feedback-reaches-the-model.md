---
phase: 4
title: "Hook feedback reaches the model"
status: done
priority: P1
effort: "3d"
dependencies: [1]
---

# Phase 4: Hook feedback reaches the model

## Context Links

- [Baseline and vendor sources](research/baseline-and-vendor-sources.md) — N6; §3 Fable 5.2 "token budget shown to the model"
- `docs/maintainer/host-probe-log.md` — P1 (model-visible channel per host, documented, not probed)
- `.claude/hooks/handlers.json`, `.claude/hooks/dispatch.cjs:30-46,102-124`
- `.claude/hooks/handlers/{build-verify,loop-detection,budget-tracker,pre-task-check,safety-sentinel-inject}.cjs`
- `kit/bundles/codex/root/.codex/hooks/`, `kit/bundles/cursor/root/.cursor/hooks/` (`session-context`, `telemetry-observers`, `stop-followup`, `subagent-lifecycle`)
- `docs/research/meowkit-evolution-2611/05-skill-agent-rule-hook-audit.md` §3.2, C-14, C-15
- Prior snapshot facts #37, #51, #56, #57 in `docs/plans/261115-remove-gates-audit-runtimes-coexistence/research/runtime-docs-index.md`

## Overview

- **Priority:** P1
- **Status:** Done (worktree, branch `integration/model-fit-audit`)
- **Effort:** 3d
- **Depends on:** Phase 1
- **Description:** For every hook that writes text meant for the model, make it use the channel that host documents as model-visible, word it as a plain instruction with its reason, or retire it when its only job was a message nobody reads. One pull request; guards (`privacy-block`, `pre-ship`) are out of scope except message wording.

## Key Insights

- Claude Code shows PostToolUse exit-2 stderr to the model and `additionalContext` (≤10,000 chars) as context; plain stdout on PreToolUse/PostToolUse is not listed as model-visible (from: snapshot #37, #51; probe log P1). Four handlers print plain stdout there (N6), so their warnings likely never act.
- `build-verify` runs a type-check and lint on every edit (about 0.8–2 s, audit §3.2); if its result is invisible, the cost buys nothing.
- `budget-tracker` shows a spend figure; Fable 5.2 guidance found that a budget shown in the prompt changes how much the model spends and that removing it lowered cost (§3). It also has a unit mismatch (audit C-13).
- `safety-sentinel-inject` adds about 40 tokens per prompt (audit C-15); whether sub-agents and bundles need it is untested.
- Live probes were declined in the prior plan; this phase follows the documented channel and records it as documented, with a probe offered (ask first).

## Requirements

### Functional
1. Inventory every hook output path on three runtimes: event, channel used, channel the host documents as model-visible, audience (model, user, file).
2. `loop-detection` and `pre-task-check` (model audience): return host-visible feedback — Claude Code `hookSpecificOutput.additionalContext` on PostToolUse, Codex and Cursor in their documented form — or are retired if the host has no such channel for that event.
3. `build-verify`: either its failure reaches the model in host form, or it stops running per edit (the ship check already runs lint and type-check at commit). Decision recorded; retiring needs the user's OK.
4. `budget-tracker`: stops showing a spend figure to the model; keeps writing the cost log; unit mismatch fixed or documented.
5. Every model-facing hook message reads as a plain instruction with its reason and the next action; no "BLOCK"/"STOPPED" wording on a hook that does not block.
6. `dispatch.cjs` gains one documented way for a handler to return model-visible feedback per host, used by the handlers above.

### Non-Functional
- Guard decisions (`privacy-block`, `pre-ship`) unchanged; `tests/guards` green.
- `bundled` hook lib files stay byte-identical across trees (`node scripts/sync-hook-core.cjs --check`).

## Architecture

```
handler result {audience: model|user|state, text}
  → dispatch.cjs maps to host form:
     Claude Code PostToolUse → hookSpecificOutput.additionalContext
     Codex / Cursor          → documented field for that event, else user-only
  → replay case asserts the JSON the host reads
```

## Related Code Files

### Files to Create
- `docs/maintainer/hook-output-channels.md` (inventory table, one row per handler per runtime)

### Files to Modify
- `.claude/hooks/dispatch.cjs`, `.claude/hooks/handlers/{loop-detection,pre-task-check,build-verify,budget-tracker}.cjs`
- `.claude/hooks/handlers.json` (only if a handler is retired, with OK)
- Codex and Cursor hook copies that mirror the same messages
- `tests/hooks/` replay cases; `scripts/lib/hook-corpus-cases-*.cjs`
- `docs/core/enforcement-matrix.md` if a control's row changes

### Files to Read (Context)
- `docs/maintainer/host-probe-log.md` — what each host documents
- `.claude/hooks/lib/config-rules.cjs:73-78` — which hooks config may toggle

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Modify | `.claude/hooks/dispatch.cjs` | host-form feedback | replay suite |
| Modify | four handlers | channel, wording, budget text | corpus cases |
| Create | `docs/maintainer/hook-output-channels.md` | inventory | none |
| Modify | bundle hook copies | same wording | `sync-hook-core.cjs --check` |
| Modify | `tests/hooks/golden/*` | new JSON | hand-edit, `DIVERGENCES.md` row if frozen |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Observer output reaches the model | none | replay asserts `additionalContext` JSON | High |
| Budget figure not shown to model | none | replay asserts absence | Medium |

### Interface Checklist

- `handlers.json` schema (`event`, `matcher`, `handler`, `toggleKey`) and config toggle keys stay.
- Stop-block JSON of the completion check unchanged.

### Dependency Map

- Independent of Phases 2, 3, 5; Phase 7 records the inventory in the after table.

## Implementation Steps

1. Write the channel inventory for every handler and bundle hook from the snapshots and probe log.
2. Add host-form feedback to `dispatch.cjs`; switch `loop-detection` and `pre-task-check`; rewrite their messages.
3. Decide `build-verify` with the user (visible per edit, or retired in favour of the ship check); apply.
4. Remove the model-facing budget figure; fix or document the unit mismatch.
5. Mirror message changes in the bundles; run `sync-hook-core.cjs --check`, `npx vitest run tests/hooks tests/guards`.
6. Offer the live probe (one scratch project per host); record result or "declined" in the probe log.

## Todo List

- [x] Channel inventory written
- [x] Host-form feedback in dispatcher; two observers switched
- [x] `build-verify` decision applied
- [x] Budget figure removed from model-facing output
- [x] Bundles mirrored; hook and guard tests green
- [ ] Live probe offered and logged

## Success Criteria

1. `docs/maintainer/hook-output-channels.md` lists every handler on three runtimes with a model-visible channel or "user/state only".
2. Replay cases assert host JSON for each model-audience handler; `npx vitest run tests/hooks tests/guards` exits 0.
3. `node scripts/sync-hook-core.cjs --check` exits 0.
4. No model-facing hook text contains "BLOCK" unless that hook exits 2 (`rg` check in the test).

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Visible feedback floods context on every edit | M | M | Emit only on a finding, cap length, dedupe per session |
| Docs and real host behaviour differ | M | M | Probe offered; inventory marks "documented, not probed" |
| Retiring `build-verify` loses a signal users like | L | L | Toggle key kept off by default instead of deleting, if user prefers |

## Security Considerations

- Guards keep their decisions; only message wording and observer channels change.

## Outcome (2026-11-16)

- Decision: `build-verify` kept per edit (user, 2026-11-16). It already reached the model (exit 2 + stderr); its message gained a plain next-step line.
- `dispatch.cjs`: handlers return `{context}`; sent as `additionalContext` on tool events, plain stdout on UserPromptSubmit/SessionStart, stderr on a non-zero exit, dropped with a stderr note elsewhere. stdout is plain text or one JSON document; leftover plain stdout goes to `systemMessage` (user) or `additionalContext` (model-stdout events).
- `loop-detection` and `pre-task-check` now use `context`, no BLOCK/STOPPED wording; loop reminder at 4, 8, then every 4 edits.
- Also found: `post-write` warning-only findings were exit-0 stderr (invisible); now `context`.
- `budget-tracker` stays user-only on purpose; marker `@@BUDGET_BLOCK@@` → `@@BUDGET_OVER@@`. Unit mismatch already resolved: the config template documents USD.
- Codex and Cursor already use host-documented fields; no per-edit observers there, nothing to mirror.
- `mewkit doctor` injection probe now checks for the finding inside `additionalContext`.
- Frozen golden `pretaskcheck-injection-blocked` kept as the before-state, new form asserted against its findings.
- Host-probe log P1 gained a documented row for tool-event `additionalContext` (hooks reference, 2026-11-16). Live probe not run.

## Next Steps

- Phase 7 includes the inventory counts in the after table.
