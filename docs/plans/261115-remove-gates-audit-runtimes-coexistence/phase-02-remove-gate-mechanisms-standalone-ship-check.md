---
phase: 2
title: "Remove gate mechanisms, standalone ship check"
status: done
priority: P1
effort: "8d"
dependencies: [1]
---

# Phase 2: Remove gate mechanisms, standalone ship check

## Context Links

- [Verification findings](research/verification-findings.md) — full list of consumers, read first
- [Runtime-docs triage](research/runtime-docs-triage.md) — implementation notes per phase, read first
- [Scope map](research/scout-scope-map.md)
- [CLI gate surface](research/researcher-02-cli-gate-surface-and-doctor.md)
- [Bundle provenance](research/researcher-01-bundle-provenance-and-sync.md)

## Overview

- **Priority:** P1
- **Status:** Pending
- **Effort:** 8d
- **Depends on:** Phase 1
- **Description:** Delete the plan gate, approval receipt, contract check and review-verdict check from hooks, skill shims, CLI and kit metadata on all three runtimes, and leave a ship check that parses the command and runs test, lint and type-check. Lands as three pull requests on the integration branch: 2a hooks, bundles, manifests and upgrade tests; 2b CLI removal and recordings; 2c the ship check on Codex and Cursor.

## Key Insights

- `lib/core/pre-ship.cjs` loads the review-gate check before it matches the ship regex; with that lib missing every Bash command is blocked. Rewire first, delete second (from: research/verification-findings.md).
- `handlers/pre-completion-check.cjs` and three skill shims also require gate libs (from: research/verification-findings.md).
- Seven of the ten byte-synced `bundled` files are plan-gate files, `plan-discovery.cjs` among them; `sync-hook-core.cjs` never deletes orphans (from: research/verification-findings.md).
- Gate code in `crates/` is about 1,860 lines; `packs_safety.rs`, `config/schema.rs` and `validate/structure.rs` assert gate files exist (from: research/verification-findings.md).
- `upgrade` retires files by diffing the ownership index (`drop_retired`) and strips stale hook ids; `deletions.json` feeds only the release manifest (from: research/verification-findings.md).
- Golden recordings are hand-edit only, each change recorded in `DIVERGENCES.md`; the hook corpus under `tests/hooks/golden/` has its own recorder script (from: research/researcher-02-cli-gate-surface-and-doctor.md).

## Requirements

### Functional
1. No registered hook, skill shim or validator on any runtime checks for a plan, receipt, contract or verdict.
2. On all three runtimes `pre-ship` triggers on any git commit, push or merge invocation and on `gh pr create|merge`, then runs the memory lint, lint on the changed files, the tests related to them and a project-wide type-check. When the runner cannot name related tests it runs lint and type-check only and prints that tests did not run.
3. `privacy-block` sets fail-closed configuration where the host supports it; `pre-ship` does not. The ship check ignores `MEOWKIT_HOOK_PROFILE=fast`.
4. CLI: `plan approve`, `validate --gates` and `verdict-gate` are removed; `doctor --hard-gates` keeps its name and probes the surviving guards.
5. `upgrade` removes gate hook registrations first and files second on all three runtimes, including installs with no ownership index, hand-edited settings, a modified retired file and a stale registration.
6. In a project that carries the kit for more than one runtime, the ship check runs once per ship command: a second invocation for the same command and tree state exits 0 and says the check already ran.
7. The Cursor kill switch is read from the environment only; its state flag file is removed; the privacy read gate ignores the switch.

### Non-Functional
- `bundled` files stay byte-identical across the three trees; `doctor --json` row shape unchanged.
- Changed files are the staged set for a commit and the commits not yet on the upstream for a push or merge.
- Timeout and missing-interpreter behaviour of the ship check is stated per case in the probe log and tested.

## Architecture

```
before: Edit|Write → gate-enforcement → plan-gate → receipt + contract
        Bash       → pre-ship → gate2-check → regex → memory lint → test/lint/tsc
after:  Edit|Write → privacy-block only
        Bash       → pre-ship → ship-command parser → memory lint → lint(changed) + tests(related) + tsc
        (Codex and Cursor: a separate ship-check hook entry on the shell event, with its own timeout)
```

The parser tokenises the command, skips global git options (`-C`, `-c`, `--git-dir`), resolves aliases with `git config --get alias.<name>`, and matches `commit|push|merge` and `gh pr create|merge`.

## Related Code Files

### Files to Create
- `.claude/hooks/lib/ship-command.cjs`, `.claude/hooks/lib/changed-files.cjs`

### Files to Modify
- `.claude/settings.json`, `.claude/hooks/lib/core/pre-ship.cjs`, `.claude/hooks/core-closure.json`, `.claude/hooks/lib/config-keys.cjs`
- `kit/bundles/codex/root/.codex/hooks.json`, `kit/bundles/cursor/root/.cursor/hooks.json`
- `crates/mewkit-core/src/config/schema.rs`, `crates/mewkit-core/src/validate/packs_safety.rs`, `crates/mewkit-core/src/capability/lifecycle.rs`
- `crates/mewkit-cli/src/commands/plan.rs`, `crates/mewkit-cli/src/commands/doctor/hard_gates/*`
- `.github/workflows/ci.yml`, `deletions.json`

### Files to Read (Context)
- `crates/mewkit-cli/tests/golden/DIVERGENCES.md` — edit policy
- `crates/mewkit-cli/src/commands/mod.rs` (`drop_retired`), `crates/mewkit-core/src/exec/decide.rs` — retirement path

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Modify | `.claude/hooks/lib/core/pre-ship.cjs`, `preship-checks.cjs` | Parser first, no gate2; changed-file scope; fast profile ignored | Phase 1 ship cases turn green |
| Delete | `.claude/hooks/gate-enforcement.cjs`, `pre-implement.cjs` | Plan gate shell; unregistered script | `guard-root-fail-closed`, `approval-receipt-cli` |
| Delete | `.claude/hooks/lib/{core/plan-gate,gate1-*,approval-receipt,check-contract-signed,validate-contract,plan-discovery}.cjs` | Plan gate libs | `gate1-hatch.test.ts`, hook corpus |
| Delete | `.claude/hooks/lib/{gate2-*,validate-gate-2,validate-workflow-evidence,validate-review-coverage}.cjs` | Review gate libs and orphans | `gate2-ship-boundary`, `hook_mirrors/workflow_evidence.rs` |
| Delete | `.claude/skills/sprint-contract/scripts/*.cjs`, `.claude/skills/cook/scripts/validate-gate-2.cjs` + bundle copies | Shims over deleted libs | `ci.yml:52` cook script tests |
| Modify | `.claude/hooks/handlers/pre-completion-check.cjs` | Drop gate2 imports; inert until Phase 4 | `completion-gate.test.ts`, 2 corpus goldens |
| Modify | `.claude/hooks/core-closure.json`, `hook-coverage.json`, `lib/config-keys.cjs`, `lib/config-rules.cjs` | Remove `plan-gate`, protected-hook names, `gate1PresenceOnly`; `bundled` gains the pre-ship closure | `core-closure.test.cjs:56`, `tests/config` fixture |
| Delete | Codex `hooks/gate-enforcement.cjs` and both bundles' orphaned lib copies | Bundle plan gate | `validate --target codex` |
| Modify | Cursor `tool-gate.cjs`, `shell-gate.cjs`, `lib/cursor-hook-runtime.cjs`; Codex `hooks.json` | Remove `decidePlanGate`; add a ship-check hook entry; kill switch env-only | Phase 1 Cursor and Codex cases |
| Delete | `crates/**/{plan_doc/approve,plan_doc/receipt,verdict_gate,validate/gate_authority*}.rs`, `commands/verdict_gate.rs` | About 1,860 lines of gate code | 35 + 11 + 4 test files |
| Modify | `crates/mewkit-core/src/{config/schema,validate/packs_safety,validate/substrate,capability/lifecycle}.rs`, `doctor/hook_commands.rs` | Stop asserting gate files | unit tests, baseline manifests |
| Modify | `.meowkit/harness-inventory.json`, `.claude/kit-capabilities.json`, `schemas/harness-metadata-schema.json`, `deletions.json`, `ci.yml` | Metadata and lanes | `validate`, release manifest |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Ship trigger parsing | literal regex test | aliases, global options, `gh pr` | High |
| Upgrade retires gate hooks on three runtimes | ownership-diff tests | this path set, settings strip | High |
| Source write with no plan allowed | inverse only | allow case per runtime | High |
| Bash still works when a gate lib is absent | none | regression case | High |

### Interface Checklist

- `plan check --structural`, `plan archive`, `doctor --hard-gates` flag name, `core-closure.json` schema stay.
- Hint text at `validate/mod.rs:111` stays (25 recordings pin it).

### Dependency Map

- Order: parser and rewires → delete hook libs and shims → sync and prune bundles → manifests and config keys → CLI → tests and corpus.
- Phases 3, 4 and 5 start once this phase is on the integration branch.

## Implementation Steps

1. Write `lib/ship-command.cjs` and `lib/changed-files.cjs` with unit tests; switch `lib/core/pre-ship.cjs` to them, remove the gate2 load, scope lint and tests to changed files, ignore the fast profile.
2. Remove gate2 imports from `pre-completion-check.cjs`; remove the three skill shims and their CI step.
3. Delete plan-gate and review-gate hook files incl. `plan-discovery.cjs` and the two orphans; update `settings.json`, `core-closure.json`, `hook-coverage.json`, `config-keys.cjs`, `config-rules.cjs`.
4. Run `node scripts/sync-hook-core.cjs`; delete orphaned lib copies in both bundles; edit both `hooks.json`, Codex `gate-enforcement.cjs`, Cursor `tool-gate.cjs`.
5. Add fail-closed configuration to `privacy-block` per the Phase 1 probe result; add the pre-ship closure to `bundled`; register the ship check on Codex and Cursor with a run-once marker keyed by command and tree state; make the Cursor kill switch env-only.
6. Remove gate code and verbs in `crates/`; stop `packs_safety`, `schema`, `substrate` and `hook_commands` from asserting gate files; retarget `doctor/hard_gates`; reword `capability/lifecycle.rs`.
7. Update metadata JSON and `.claude`-relative `deletions.json` entries; add upgrade tests per runtime: previous kit, no ownership index, hand-edited settings, modified retired file, stale registration.
8. Run `cargo test --workspace --locked` and `npm test`; hand-edit failing npm goldens per verb with `DIVERGENCES.md` rows; re-record the hook corpus with `scripts/record-hook-golden-corpus.cjs`.
9. Drop the `validate --gates` lane; run `mewkit validate`, `validate --target codex`, `sync-hook-core.cjs --check`.

## Todo List

- [x] [CRITICAL] Ship-command parser and `pre-ship` rewire before any deletion
- [x] Decouple completion check; remove skill shims and CI step
- [x] Delete gate hook files; update settings, closure and config-key files
- [x] Sync and prune both bundles; edit both `hooks.json`
- [x] Fail-closed on `privacy-block`; ship check on Codex and Cursor, run once per command; kill switch env-only
- [x] Remove CLI gate code; fix validators that assert gate files
- [x] [HIGH] Metadata, `deletions.json`, five upgrade fixtures per runtime
- [x] Hand-edit npm goldens; re-record hook corpus
- [x] CI lane and validators green

## Success Criteria

1. `npx vitest run tests/guards` exits 0 with zero expected-fail ship cases on all three runtimes.
2. `ls .claude/hooks/gate-enforcement.cjs .claude/hooks/lib/gate2-check.cjs .claude/hooks/lib/plan-discovery.cjs` reports all missing.
3. `grep -rnE "decidePlanGate|gate2Check|approval-receipt|gate1PresenceOnly" .claude kit/bundles crates/*/src` returns nothing.
4. `node scripts/sync-hook-core.cjs --check` exits 0.
5. `cargo test --workspace --locked` and `npm test` exit 0; each runtime's five upgrade tests show no gate hook file or registration left.
6. Parser unit tests cover the six confirmed evasions; forms it cannot see (`bash -c`, scripts, other tools) are listed as not covered in the Phase 3 enforcement matrix.
7. On each runtime a commit that stages a file with a lint error exits 2; with a runner that has no related-test mode the output states that tests did not run.
8. The Phase 1 dual-install case shows the ship check running once.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| A gate lib is deleted while still required and Bash is blocked | M | H | Step order; regression case for a missing lib |
| Parser misses a ship form | M | H | Phase 1 cases; aliases resolved before matching |
| Bulk golden failures hide a real regression | M | H | Count first; edit per verb; reviewer reads each `DIVERGENCES.md` row |
| Stale gate hooks survive upgrade on Codex or Cursor | M | H | Per-runtime upgrade test |
| [RED TEAM] A customised install keeps a registration whose file is gone and edits are locked | M | H | Strip registration before file; four extra upgrade fixtures; `doctor` integrity row (Phase 5) |
| [RED TEAM] Phase is too large for one review | H | M | Two pull requests (2a, 2b); estimate 6d |
| [RED TEAM] `main` sits between gate removal and its replacements | M | H | Every pull request lands on the integration branch; `main` receives one merge after Phase 4 |
| Validated: related-test scope misses a regression elsewhere | M | M | Accepted by maintainer; type-check stays project-wide; CI runs the full suite |
| Validated: a ship check on a host never run live blocks shells | M | H | Replay cases in Phase 1; one live run per host recorded in the probe log before the merge |
| The bundles set a 10 s timeout on their shell hooks and Cursor's is fail-closed; host defaults are 600 s on Claude Code and Codex, Cursor's maximum is undocumented (from: research/runtime-docs-triage.md) | M | H | Separate hook entry with its own timeout, not fail-closed; Cursor's maximum is a Phase 1 probe; an internal deadline prints that the check did not run |
| A dual install runs the ship check twice in Cursor (from: research/runtime-docs-triage.md) | H | M | Run-once marker; Phase 1 dual-install case |

## Security Considerations

- Removes an accident guard by maintainer decision; privacy block and ship check stay and are proven by the Phase 1 suite.
- Fail-closed setting requires host 2.1.295 or later; document the floor.

## Verification Log

Full detail: [verification-findings.md](research/verification-findings.md). Checked 2026-11-15T09:53:08+07:00.
- Fact Checker: 15 verified.
- Flow Tracer: FAILED (not found) — upgrade consumes deletions.json; FAILED (not found) — verdict_gate.rs lives in mewkit-core only.
- Scope Auditor: FAILED (not found) — 13 consumers missing from the first draft; all now in the File Inventory.
- Contract Verifier: FAILED (not found) — "about 1,250 lines" of gate code (real total about 1,860).

## Next Steps

- Phase 3 rewrites the text that still describes gates.
- Validated 2026-11-15: ship check on three runtimes with changed-file scope; fast profile ignored at ship time; fail-closed on `privacy-block` only; kill switch env-only.

## Validation Log

Whole-Plan Consistency Sweep — 2026-11-15T11:48:08+07:00: 12 deltas checked, 0 reconciled, 0 unresolved. Answers: [validation-log.md](validation-log.md).
