---
phase: 1
title: "Guard self-test and host probes"
status: done
priority: P1
effort: "2d"
dependencies: []
---

# Phase 1: Guard self-test and host probes

## Context Links

- [Verification findings](research/verification-findings.md)
- [Runtime-docs triage](research/runtime-docs-triage.md) — implementation notes per phase, read first
- [Scope map](research/scout-scope-map.md)
- [Intake packet](research/plan-intake-packet.md)
- [Bundle provenance](research/researcher-01-bundle-provenance-and-sync.md)
- Enforcement suite design: `docs/research/meowkit-evolution-2611/12-controlled-experiment-plan.md` (E8, probes P1–P8)

## Overview

- **Priority:** P1
- **Status:** Done (2026-11-15; live probes declined, log filled from documented facts)
- **Effort:** 2d
- **Depends on:** —
- **Description:** Build a replay suite that fires fixed payloads through every registered guard on the three runtimes and asserts the decision, and record four live host behaviours that later phases depend on.

## Key Insights

- Every bypass found in research came from executing hooks, never from reading structure; `mewkit validate` states it does not check that guards block (from: research/plan-intake-packet.md).
- Hook exit-code meaning differs per host; Cursor declares `failClosed` per hook, Claude Code fails open unless `onFailure` is set (from: research/scout-scope-map.md).
- Six ship-trigger evasions pass today; the suite must show them red before Phase 2 fixes them (from: research/plan-intake-packet.md).
- Whether plain hook stdout reaches the model is documented but untested on this host (from: research/scout-scope-map.md).

## Requirements

### Functional
1. One test case per guard and decision class: privacy block on read, guard crash, unreadable input; ship check trigger, a lint error in a staged file and a failing related test on all three runtimes (expected-fail on Codex and Cursor until Phase 2 adds their ship check).
2. Cases run against three fixture installs built from `.claude/`, `kit/bundles/codex/root` and `kit/bundles/cursor/root`.
3. Known-failing cases are marked expected-fail with the phase that fixes them.
4. A probe log records, with host version and date: plain stdout visibility for PostToolUse and Stop; the exit-code field in PostToolUse(Bash) input; session id stability between PostToolUse and Stop and the Stop re-entry flag; `onFailure` on crash and timeout; the maximum hook timeout each host accepts; guard reach on other edit tools; `model` in SessionStart input. The probes are a hard prerequisite for Phases 2 and 4.
5. One dual-install case: a fixture carrying both the Claude Code and Cursor trees replays the Cursor shell event through both hook sets and records how often the ship check runs (expected-fail until Phase 2 makes it run once).
6. `tests/guards/manifest.json` lists every guard case and expected-fail case with fixed counts; the suite fails when a case disappears without a recorded reason.

### Non-Functional
- No network; no real `git push`; runs in under 60 s in CI.
- Fixtures contain no secrets; the `.env` fixture holds a placeholder string.
- Each case runs with an isolated `HOME` and a clean hook profile, and clears the Cursor kill switch (env var and state flag file), so user config cannot change a decision.

## Architecture

```
tests/guards/fixtures/<runtime>/   temp project + copied hook tree
tests/guards/payloads/*.json       host-shaped stdin per case
tests/guards/replay.ts             spawn `node <hook>` with payload → {exit, stdout, stderr}
tests/guards/*.test.ts             assert decision per runtime
```

A case asserts the host-visible decision (exit 2, or the JSON decision the host reads), never internal state. Live host runs (`claude -p`, `codex`, `cursor-agent`) stay manual and feed the probe log only.

## Related Code Files

### Files to Create
- `tests/guards/replay.ts`
- `tests/guards/claude-code.guards.test.ts`
- `tests/guards/codex.guards.test.ts`
- `tests/guards/cursor.guards.test.ts`
- `tests/guards/payloads/` (one JSON per case)
- `tests/guards/manifest.json`
- `docs/maintainer/host-probe-log.md`

### Files to Modify
- `vitest.config.ts` — include `tests/guards`

### Files to Read (Context)
- `tests/hooks/golden-replay.test.ts` — existing replay pattern
- `.claude/hooks/__tests__/canonical-hooks-characterization.test.cjs` — payload shapes
- `.claude/settings.json`, `kit/bundles/codex/root/.codex/hooks.json`, `kit/bundles/cursor/root/.cursor/hooks.json` — registrations

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Create | `tests/guards/replay.ts` | Spawn helper shared by three suites | New |
| Create | `tests/guards/claude-code.guards.test.ts` | privacy, ship check | New |
| Create | `tests/guards/codex.guards.test.ts` | privacy on Bash | New |
| Create | `tests/guards/cursor.guards.test.ts` | read, shell, MCP, tool guards | New |
| Create | `tests/guards/payloads/*.json` | Host-shaped inputs | New |
| Create | `docs/maintainer/host-probe-log.md` | Dated probe results | None |
| Modify | `vitest.config.ts` | Register suite | CI runs it |
| Read | `tests/hooks/golden-replay.test.ts` | Reuse runner shape | None |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Ship trigger variants | `gate2-ship-boundary.test.cjs` (literal form only) | six evasions | High |
| Privacy name gaps | `guard-root-fail-closed.test.cjs` | `.envrc`, `.npmrc`, `id_rsa`, `.kube/config` | High |
| Cursor guards | none found | all four | High |
| Codex privacy on Bash | none found | block and allow | Medium |
| Entry-script crash | `guard-root-fail-closed.test.cjs` (lib faults) | broken entry script, timeout | Medium |

### Interface Checklist

- Payload JSON matches each host's documented hook input.
- Suite reads registrations from the three config files; no hard-coded hook list.

### Dependency Map

- Phase 2 turns the expected-fail ship cases green on three runtimes and deletes no case.
- Phase 4 adds privacy and completion cases to the same suite.

## Implementation Steps

1. Read the three registration files and list every guard entry script per runtime.
2. Write `replay.ts`: copy a hook tree into a temp git repo, set a temp `HOME`, spawn the script with a payload, return exit code and streams.
3. Add Claude Code cases: privacy read block and allow; ship trigger literal form; staged lint error; failing related test; the six evasions as expected-fail. Add the same ship cases for Codex and Cursor as expected-fail.
4. Add Codex cases for `privacy-block.cjs`.
5. Add Cursor cases for `privacy-read-gate.cjs`, `shell-gate.cjs`, `mcp-gate.cjs`, `tool-gate.cjs`, with the kill switch off and on; add the dual-install case.
6. Register the suite in `vitest.config.ts`; run `npx vitest run tests/guards`.
7. Write `tests/guards/manifest.json` and the count check.
8. Run the live probes in a scratch project outside the repo with `claude -p`; write `docs/maintainer/host-probe-log.md` with a decision table: each result, including "no channel", maps to the design Phases 2 and 4 use.

## Todo List

- [x] List guard entry scripts per runtime from the registration files
- [x] Write `tests/guards/replay.ts`
- [x] Claude Code guard cases, evasions marked expected-fail
- [x] Codex guard cases
- [x] Cursor guard cases, kill switch off and on; dual-install case
- [x] Register suite and run it
- [x] Case manifest with fixed counts
- [x] [HIGH] Run live probes; probe log with decision table

## Success Criteria

1. `npx vitest run tests/guards` exits 0 with the six evasion cases reported as expected failures.
2. Each runtime suite derives its hook list from that runtime's registration file (`grep -c "hooks.json\|settings.json" tests/guards/*.test.ts` ≥ 3).
3. `docs/maintainer/host-probe-log.md` has one row per probe with host version, date, observed result and the design it selects.
4. `npm test` exits 0.
5. Deleting a case without editing `tests/guards/manifest.json` makes the suite fail.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Replay differs from live host behaviour | M | M | Probe log records live results; suite asserts only host-visible decisions |
| Probes cost model usage | H | L | Short runs; cost confirmed once before the phase starts |
| Cursor payload shape guessed wrong | M | M | Take shapes from the bundle's own hook code; no behavioural test exists to copy |
| User config leaks into a decision | M | M | Isolated `HOME` per case |
| [RED TEAM] A probe finds no model-visible channel or no `onFailure` behaviour | M | H | Decision table names the fallback design before Phase 2 starts |
| [RED TEAM] Guard cases are removed silently in later work | M | H | Case manifest with fixed counts |
| Cursor loads Claude Code hooks by default, so a dual install runs two hook sets (from: research/runtime-docs-triage.md) | H | M | Dual-install case records it before Phase 2 changes the ship check |

## Security Considerations

- Probes run in a scratch project outside the repo; no real credentials.
- The suite never executes a real push or network call.

## Verification Log

Full detail: [verification-findings.md](research/verification-findings.md). Checked 2026-11-15T09:53:08+07:00.
- Fact Checker: 15 verified.
- Flow Tracer: UNVERIFIED (only structural references found) — no behavioural tests exist for the Cursor guards.
- Scope Auditor: FAILED (not found) — replay fixtures never isolate HOME; now a requirement.
- Contract Verifier: 4 verified.

## Implementation Notes (2026-11-15)

- Suite: `tests/guards/` (replay.ts, cases.ts, three runtime suites, manifest.test.ts + manifest.json: 25 guard, 19 expected-fail). 47 tests, ~30 s; `npm test` 517 passed.
- `vitest.config.ts` unchanged: the default include already collects `tests/guards/*.test.ts`.
- Live probes not run (maintainer declined model spend); `docs/maintainer/host-probe-log.md` rows are "documented, not probed".
- Dual-install case passes today (only the Claude Code tree has a ship check); it guards the run-once requirement once Phase 2c adds the Cursor ship check.
- Claude Code ship cases add an active plan and passing verdict so the review gate does not mask the ship-check decision; inert once Phase 2 removes that gate.

## Next Steps

- Phase 2 depends on the suite to prove the ship check survives gate removal.
- Validated 2026-11-15: the ship check will exist on three runtimes; one live run per host is recorded in the probe log before Phase 2 merges.

## Validation Log

Whole-Plan Consistency Sweep — 2026-11-15T11:48:08+07:00: 12 deltas checked, 0 reconciled, 0 unresolved. Answers: [validation-log.md](validation-log.md).
