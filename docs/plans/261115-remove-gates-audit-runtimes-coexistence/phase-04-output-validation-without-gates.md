---
phase: 4
title: "Output validation without gates"
status: done
priority: P1
effort: "3.5d"
dependencies: [2]
---

# Phase 4: Output validation without gates

## Context Links

- [Verification findings](research/verification-findings.md) — state scope, read first
- [Runtime-docs triage](research/runtime-docs-triage.md) — implementation notes per phase, read first
- [Scope map](research/scout-scope-map.md)
- [Intake packet](research/plan-intake-packet.md)
- Signal defects: `docs/research/meowkit-evolution-2611/07-observability-and-evaluation-architecture.md`
- Probe log (Phase 1): `docs/maintainer/host-probe-log.md`

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** 3.5d
- **Depends on:** Phase 2
- **Description:** Make the checks that survive gate removal effective: a completion check that fires when edits are unverified, build feedback the model can see, closed privacy and scanner gaps, and the verified mechanical fixes. Lands as three pull requests: 4a evidence, completion check and feedback; 4b privacy and scanner; 4c density, budget, dead references and retirements.

## Key Insights

- `pre-completion-check.cjs` is armed only by `verification-required.json`, which nothing writes; it scans the trace for `test_result` pass, which nothing writes either (from: research/verification-findings.md).
- The trace is cumulative across sessions; `file_edited` comes only from `learning-observer.cjs`, which the fast profile and a toggle both skip. A completion rule cannot rest on the trace (from: research/verification-findings.md).
- `dispatch.cjs` already orders `feedback: true` results last but emits no host JSON; `build-verify.cjs` returns plain text with exit 0 (from: research/verification-findings.md).
- Privacy block misses `.envrc`, `.npmrc`, `id_rsa`, `.kube/config` and false-positives on `secretary.ts`, `.env.example`; the scanner skips `.tsx`, `.py`, `.mjs` (from: research/plan-intake-packet.md).
- Density has three sources: `density-select.sh`, `model-detector.cjs`, and `autobuild.mode` read at `pre-completion-check.cjs:96`; `budget-state.json` is never reset (from: research/verification-findings.md).
- Cursor registers a `stop` hook with `loop_limit: 5`; the Codex bundle registers none, although Codex has a Stop hook whose block continues the turn (from: research/runtime-docs-triage.md).
- A hook on `Edit|Write` does not run when a shell command rewrites a file, so edits must be read from the working tree, not from that hook (from: research/runtime-docs-triage.md).

## Requirements

### Functional
1. A new observer records, per session, the last passing verification command (test, build, lint, type-check, exit 0) and a digest of the working-tree state at that moment. Whether source changed since is read from the working tree at stop time, so edits made through the shell count. Outside a git repository the check does not arm.
2. The completion check is off by default and enabled through config. When enabled it blocks stop when the working tree differs from its state at the last passing verification, at most twice, then lets the session end with a notice.
3. Build-verify failures reach the model through the channel the Phase 1 probe confirmed.
4. Budget and loop messages are labelled advisory in text and docs and do not stop work; budget state resets with the session.
5. Privacy block covers the four missing names and passes the two false positives, matching anchored basenames after path normalisation; one shared corpus (incl. traversal, symlink, case and near-miss names) yields the same decision on each of the three runtimes.
6. Post-write scanner covers `.tsx`, `.jsx`, `.py`, `.mjs`, `.go` and the two missed patterns.
7. One density lookup is read by all three consumers; budget thresholds use one unit.
8. Dead path references are fixed; the checker fails on a seeded dead path; tracked `*.md.tmp` files and `mk:lazy-agent-loader` are retired with their bundle copies and catalog entries.

### Non-Functional
- Observers stay fail-open; only the completion check may delay a stop, within its cap.
- Evidence state lives in the session-state directory and is cleared on session reset.
- The completion check is advisory evidence of effort, not proof: a trivial passing command satisfies it and the agent can write its state file. Docs say so.

## Architecture

```
PostToolUse(Bash) → verification-evidence observer → session-state/verification-evidence.json
                        {lastPassAt, lastPassCommandClass, treeDigestAtPass}
Stop → pre-completion-check: tree digest now ≠ treeDigestAtPass ? {decision: block, reason} ≤ cap : notice
dispatch.cjs → host JSON for results marked feedback: true
```

## Related Code Files

### Files to Create
- `.claude/hooks/handlers/verification-evidence.cjs`
- `.claude/hooks/lib/density-lookup.cjs`

### Files to Modify
- `.claude/hooks/handlers.json` — register the observer on the PostToolUse Bash matcher
- `.claude/hooks/handlers/{pre-completion-check,build-verify,budget-tracker,loop-detection,post-write,model-detector,project-context-loader}.cjs`
- `.claude/hooks/dispatch.cjs`, `.claude/hooks/lib/core/privacy.cjs`
- `.claude/skills/autobuild/scripts/density-select.sh`
- `kit/bundles/cursor/root/.cursor/hooks/stop-followup.cjs`, `kit/bundles/codex/root/.codex/hooks.json` (new Stop entry)
- `scripts/check-skill-cross-refs.sh`, `scripts/seed-ownership-metadata.cjs`, `kit/bundles/*/catalog/skill-packs.json`

### Files to Read (Context)
- `tests/hooks/completion-gate.test.ts`, `tests/hooks/golden/precompletion-*.json`, `scripts/lib/hook-corpus-cases-feedback.cjs`

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Create | `.claude/hooks/handlers/verification-evidence.cjs` | Per-session pass time and tree digest | new unit test |
| Modify | `.claude/hooks/handlers.json` | Register observer, toggle key | `observer-toggles.test.ts`, `check-hook-registration.test.sh` |
| Modify | `.claude/hooks/handlers/pre-completion-check.cjs` | Arm on unverified edits | `completion-gate.test.ts`, 2 corpus goldens re-recorded |
| Modify | `.claude/hooks/dispatch.cjs` | Host JSON for feedback results | `dispatcher.test.ts`, feedback corpus |
| Modify | `.claude/hooks/handlers/build-verify.cjs` | Mark failure as feedback | new case |
| Modify | `.claude/hooks/handlers/{budget-tracker,loop-detection,project-context-loader}.cjs` | Channel or label; session reset | `session-start-context.test.ts` |
| Modify | `.claude/hooks/lib/core/privacy.cjs` | Name gaps, false positives | `tests/guards`, three runtimes |
| Modify | `.claude/hooks/handlers/post-write.cjs` | Extensions, patterns | `post-write-security.test.cjs` |
| Create | `.claude/hooks/lib/density-lookup.cjs` | One source for three consumers | `resolve-model.test.cjs` |
| Modify | Cursor `stop-followup.cjs`; Codex `hooks.json` + new stop hook script | Same completion rule on three runtimes | `tests/guards` Cursor and Codex cases |
| Delete | `.claude/skills/lazy-agent-loader/` + bundle copies, tracked `*.md.tmp` (12) | Deprecated, stray | catalogs, inventory tests |
| Modify | `scripts/check-skill-cross-refs.sh` | Catch dead paths | seeded-failure test |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Completion check fires on unverified edits | gate-era test | arm, cap, release, new session | High |
| Evidence is per session | none | second session does not inherit a pass; an edit made through Bash arms the check | High |
| Trivial pass satisfies the check | none | no-op test script, empty selection, observer disabled | High |
| Feedback reaches the model | ordering only | host JSON emitted | High |
| Privacy name gaps | none | four names, two false positives | High |
| Density agreement | `resolve-model.test.cjs` | three consumers agree per id | Medium |

### Interface Checklist

- `handlers.json` schema unchanged; one new entry and toggle key.
- `core/privacy.cjs` stays in `bundled`, synced byte-identical.

### Dependency Map

- Needs the Phase 1 probe result for the output channel.
- Needs Phase 2: the completion check no longer imports gate libs.

## Implementation Steps

1. Write `verification-evidence.cjs`; classify Bash commands by runner name; store the tree digest on a pass; register it in `handlers.json`; unit-test negative cases.
2. Rewrite `pre-completion-check.cjs` to compare the current tree digest with the evidence file; cap attempts; rewrite `completion-gate.test.ts`; re-record the two corpus goldens.
3. Make `dispatch.cjs` emit the host's JSON form for feedback results; switch `build-verify.cjs`.
4. Label budget and loop messages advisory; reset budget state in `resetSessionState`.
5. Fix `core/privacy.cjs`; run `sync-hook-core.cjs`; add guard cases for three runtimes.
6. Extend `post-write.cjs` extensions and patterns.
7. Create `density-lookup.cjs`; point the script, the detector and the completion check at it; fix the budget unit.
8. Fix dead references and the checker; retire the deprecated skill with bundle copies, catalog entries and `seed-ownership-metadata.cjs` references; remove tracked temp files.
9. Apply the completion rule in Cursor `stop-followup.cjs`; register a Stop hook carrying it in the Codex bundle (a block continues the turn; honour `stop_hook_active`).

## Todo List

- [x] Verification-evidence observer, registered and tested
- [x] [CRITICAL] Completion check rewrite with cap; tests and corpus
- [x] Dispatcher host JSON; build-verify switched
- [x] Budget and loop messages labelled advisory; budget reset
- [x] [HIGH] Privacy gaps closed and synced to three runtimes; scanner extensions and patterns
- [x] One density lookup for three consumers; budget unit
- [x] Dead references, checker, retired skill and temp files
- [x] Cursor and Codex stop hooks

## Success Criteria

1. `npx vitest run tests/hooks/completion-gate.test.ts` exits 0 with arm, cap, release, new-session, no-op-script, disabled-observer and edit-through-Bash cases.
2. `npx vitest run tests/guards` exits 0 including four new privacy names and one parity corpus on three runtimes.
3. `node scripts/sync-hook-core.cjs --check` exits 0.
4. A test in `resolve-model.test.cjs` shows `density-select.sh`, `model-detector.cjs` and the completion check return the same tier for every id in the lookup.
5. `bash scripts/check-skill-cross-refs.sh` exits non-zero on a seeded dead path and zero on the tree; `git ls-files '*.md.tmp'` prints nothing.
6. `npm test` exits 0.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Completion check loops or annoys | L | M | Off by default; cap of two; arms only on source edits |
| A command is misread as a passing verification | M | H | Match runner name and exit 0 only; negative unit tests |
| Privacy change blocks legitimate reads | L | M | False-positive cases in the suite |
| [RED TEAM] Evidence is tamperable or satisfied by a trivial command | H | M | Documented as advisory; negative tests; `doctor` weakened row covers a disabled observer |
| [RED TEAM] A privacy exclusion opens a bypass on one runtime | M | H | Anchored matching; parity corpus with traversal, symlink and case variants |
| [RED TEAM] Session identity differs between the observer and the stop hook | M | H | Session key and re-entry flag come from the Phase 1 probe |

## Security Considerations

- Privacy block is a security control: additive names plus two precise exclusions, tested on three runtimes.
- Evidence records command class, exit code and timestamps only, never output or arguments.

## Verification Log

Full detail: [verification-findings.md](research/verification-findings.md). Checked 2026-11-15T09:53:08+07:00.
- Fact Checker: 15 verified.
- Flow Tracer: FAILED (not found) — the dispatcher has no feedback channel (it already orders feedback results last).
- Scope Auditor: FAILED (not found) — trace is cumulative and `file_edited` is skippable; design moved to a session-state file. FAILED (not found) — third density source; budget never reset.
- Contract Verifier: 5 verified.

## Next Steps

- Deferred: host telemetry as cost source.
- Validated 2026-11-15: completion check is opt-in with a cap of two, on all three runtimes; budget and loop messages are advisory.

## Validation Log

Whole-Plan Consistency Sweep — 2026-11-15T11:48:08+07:00: 12 deltas checked, 0 reconciled, 0 unresolved. Answers: [validation-log.md](validation-log.md).
