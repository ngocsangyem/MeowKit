---
phase: 5
title: "Coexistence report in doctor"
status: done
priority: P2
effort: "3d"
dependencies: [2]
---

# Phase 5: Coexistence report in doctor

## Context Links

- [Verification findings](research/verification-findings.md)
- [Runtime-docs triage](research/runtime-docs-triage.md) — implementation notes per phase, read first
- [CLI gate surface and doctor](research/researcher-02-cli-gate-surface-and-doctor.md)
- [Scope map](research/scout-scope-map.md)
- [Intake packet](research/plan-intake-packet.md)
- Coexistence evidence: `docs/research/meowkit-evolution-2611/evidence-ledger.md` (L-07, L-08), `06-cli-and-adapter-architecture.md` §6

## Overview

- **Priority:** P2
- **Status:** Pending
- **Effort:** 3d
- **Depends on:** Phase 2
- **Description:** `mewkit doctor` reports where MeowKit shares a host with other toolkits: agent name collisions, foreign hooks on the same events, overlapping instruction files and skill-listing pressure, plus non-green rows when a check is weakened or a guard file has drifted from what was shipped.

## Key Insights

- `doctor` already has `Check{name,status,detail}` (`doctor/mod.rs:65`), project and global scope through `Place`, an ownership index (`ownership.rs:40`) and hook-command parsing (`hook_commands.rs`) (from: research/researcher-02-cli-gate-surface-and-doctor.md).
- It cannot yet see `~/.claude/{agents,skills,rules}`, installed plugins or other toolkits' skill and agent names (from: research/researcher-02-cli-gate-surface-and-doctor.md).
- Observed on one machine: 8 agent names shared with a user-global toolkit, a same-named rule file on both sides, most MeowKit skill descriptions dropped from a listing budget shared by all installed toolkits (from: research/plan-intake-packet.md).
- `privacy-block` and `pre-ship` cannot be disabled by config; what can be weakened is the observers (through `hooks.*` toggles or `MEOWKIT_HOOK_PROFILE=fast`) and the Cursor guards other than privacy through the kill switch. `doctor` stays green in each case (from: research/verification-findings.md).
- No test asserts the `detail` key of `doctor --json` rows (from: research/verification-findings.md).
- Cursor loads Claude Code and Codex hooks, skills and agents by default and runs every matching hook; host settings such as `disableAllHooks` or managed-only hooks stop kit hooks from running at all (from: research/runtime-docs-triage.md).
- Hooks from several sources all run and a deny wins, so another toolkit cannot override a MeowKit guard; the report informs, it does not fix (from: research/plan-intake-packet.md).

## Requirements

### Functional
1. Row `coexistence: agent names` — names defined in more than one scope for the runtime, with the precedence the host documents, labelled unverified.
2. Row `coexistence: foreign hooks` — hooks on events MeowKit also uses that the ownership index does not own; executable name only, arguments redacted.
3. Row `coexistence: instruction files` — other always-on instruction sources present (user-level instruction file, user rules, same-basename rule files) with byte counts.
4. Row `coexistence: skill listing` — count and total name-plus-description characters per source, with a warning above a configurable threshold.
5. Row `checks: weakened` — non-green when an observer toggle is off, the fast hook profile is set, the Cursor kill switch env var is set, the host is older than the fail-closed floor for `privacy-block`, or host configuration stops kit hooks from running (Claude Code `disableAllHooks` or managed-only hooks; Codex hooks feature off or managed-only hooks).
6. Row `guards: integrity` — non-green when an installed guard file differs from the shipped hash or a registered hook points at a missing file.
7. An optional host profile (deny rules and sandbox settings covering the guard files and hook config) ships as an example, with a test that it parses and names those paths.
8. Row `coexistence: cross-runtime load` — non-green when one project carries the kit for more than one runtime and a host loads another runtime's tree (Cursor loads `.claude/` and `.codex/`), listing which hooks, skills and agents load twice.
9. Rows appear in text and `--json`; status is `ok` or `warn`, never `fail`.

### Non-Functional
- Read-only; reads names, sizes and hook commands only, never file bodies beyond frontmatter; no symlink following; byte and entry caps; control characters stripped; plugin directories scanned only with an explicit flag.
- A missing or unreadable home directory yields an `ok` row with a note, not an error.
- `doctor --json` row shape unchanged.

## Architecture

```
doctor::run → installs::checks → coexistence::checks(place, place.other()) → rows
coexistence.rs: scan_agents · foreign_hooks (ownership index) · instruction_sources · skill_listing
hooks.rs: weakened_checks from resolved config, hook profile env and the Cursor kill switch
```

Per-runtime paths come from the existing adapter scope model; no new path constants in `doctor`.

## Related Code Files

### Files to Create
- `crates/mewkit-cli/src/commands/doctor/coexistence.rs`
- `crates/mewkit-cli/tests/doctor_coexistence.rs`
- `crates/mewkit-cli/src/commands/doctor/integrity.rs`
- `.meowkit/host-guard-profile.example.json`

### Files to Modify
- `crates/mewkit-cli/src/commands/doctor/mod.rs` — call the new checks
- `crates/mewkit-cli/src/commands/doctor/hooks.rs` — weakened-checks row
- `README.md` — doctor section

### Files to Read (Context)
- `crates/mewkit-cli/src/commands/doctor/installs.rs` — both-scope warning pattern
- `crates/mewkit-core/src/ownership.rs`, `crates/mewkit-adapters/src/scope.rs`
- `crates/mewkit-cli/tests/npm_behaviour/doctor_cases.rs` — frozen cases, not edited

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Create | `crates/mewkit-cli/src/commands/doctor/coexistence.rs` | Four coexistence rows | new test file |
| Modify | `crates/mewkit-cli/src/commands/doctor/mod.rs` | Wire into `run()` | existing doctor tests keep passing |
| Modify | `crates/mewkit-cli/src/commands/doctor/hooks.rs` | Weakened-checks row | new cases: toggle, fast profile, kill switch |
| Read | `crates/mewkit-cli/src/commands/doctor/hook_commands.rs` | Reuse command parsing | none |
| Read | `crates/mewkit-core/src/ownership.rs` | Kit-owned hook ids | none |
| Read | `crates/mewkit-adapters/src/scope.rs` | Project and global paths per runtime | none |
| Create | `crates/mewkit-cli/tests/doctor_coexistence.rs` | Fixtures with a second toolkit in a temp home | new |
| Modify | `README.md` | Document rows | docs tests |
| Move | `tasks/plans/261115-remove-gates-audit-runtimes-coexistence/` | Packaging dirs left clean | source path gone, destination exists |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Name collision detected | none | project vs user scope, per runtime | High |
| Foreign hook listed | both-scope duplicate warning only | third-party handler on same event | High |
| Weakened check non-green | none | toggle, fast profile, kill switch, `disableAllHooks`, managed-only | High |
| Kit colliding with itself across runtimes | none | project with `.claude/` and `.cursor/` trees | High |
| `detail` key present in JSON rows | none (`name`, `status` only) | assert all three keys | Medium |
| No home directory | none | graceful `ok` row | Medium |
| JSON shape stable | `doctor_cases.rs` | new rows use same shape | Medium |

### Interface Checklist

- `Check{name,status,detail}` serialisation unchanged.
- New rows are additive; frozen `doctor_cases.rs` recordings still pass or get a `DIVERGENCES.md` row.
- No new verb or flag unless the interview asks for one.

### Dependency Map

- Needs Phase 2: `doctor/hard_gates` and `mod.rs` settle first.
- Independent of Phases 3 and 4.

## Implementation Steps

1. Read `installs.rs`, `ownership.rs`, `scope.rs`; list per-runtime project and global paths for agents, skills, rules and hook config.
2. Write `coexistence.rs` with five functions returning `Check` rows (incl. cross-runtime load); names and sizes only.
3. Add the weakened-checks row from resolved config, the hook profile env and the Cursor kill switch; add `integrity.rs` comparing installed guard files and registrations with the ownership index.
4. Wire into `run()`; confirm text and `--json` output.
5. Write `doctor_coexistence.rs` with temp-home fixtures: clean, second toolkit, foreign hook, weakened check, dual-runtime install, `disableAllHooks`, no home; assert `name`, `status` and `detail` on JSON rows; add fixtures with a token in settings, a symlink and oversized frontmatter.
6. Run `cargo test --workspace --locked`; record any frozen-case change in `DIVERGENCES.md`.
7. Document the rows in README; add `.meowkit/host-guard-profile.example.json` and its parse test.
8. Housekeeping: move this plan directory to `docs/plans/`; confirm the source path is gone and the criteria checker does not scan the destination.

## Todo List

- [x] Per-runtime path list from the scope model
- [x] `coexistence.rs` with five rows
- [x] Weakened-checks row and integrity row
- [x] Redaction, symlink and cap tests; optional host profile
- [x] Wire into `run()`; text and JSON
- [x] [HIGH] Fixture tests incl. no-home case
- [x] Workspace tests green; divergences recorded
- [x] README section
- [x] [HIGH] Move plan directory; packaging dirs clean

## Success Criteria

1. `cargo test -p mewkit-cli --locked --test doctor_coexistence` exits 0.
2. On the second-toolkit fixture, `mewkit doctor --json` contains rows named `coexistence: agent names`, `coexistence: foreign hooks`, `coexistence: instruction files`, `coexistence: skill listing` with status `warn`; on the dual-runtime fixture `coexistence: cross-runtime load` is `warn`.
3. With `hooks.post-write: false` in project config, and separately with `MEOWKIT_HOOK_PROFILE=fast`, `mewkit doctor` shows `checks: weakened` as `warn`.
4. `cargo test --workspace --locked` exits 0.
5. `test -d docs/plans/261115-remove-gates-audit-runtimes-coexistence && ! test -e tasks/plans/261115-remove-gates-audit-runtimes-coexistence` succeeds.
6. With a guard file edited in a fixture install, `mewkit doctor` shows `guards: integrity` as `warn`; a token placed in a settings fixture never appears in `doctor --json` output.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Reading the home directory surprises users | M | M | Names and sizes only; documented; rows say what was read |
| False collision warnings | M | L | Report scope and which copy the host uses; `warn` only |
| Listing threshold wrong for large context windows | H | L | Configurable; row prints raw numbers |
| Plugin directory layout changes | M | L | Treat as optional source; `ok` with note when unreadable |
| [RED TEAM] Hook commands or frontmatter from other toolkits leak tokens or carry injected text | M | H | Executable name only; redaction; control characters stripped; token fixture test |
| [RED TEAM] Guard files or registrations are edited once the plan gate is gone | M | H | Integrity row; optional host deny and sandbox profile |
| [RED TEAM] Collision precedence is stated wrongly | M | L | Row cites host documentation and labels it unverified |

## Security Considerations

- Read-only outside the project; no file bodies, no environment values, no network.
- Hook commands are printed as registered; paths may reveal user directory names in local output only.

## Verification Log

Full detail: [verification-findings.md](research/verification-findings.md). Checked 2026-11-15T09:53:08+07:00.
- Fact Checker: 14 verified.
- Flow Tracer: UNVERIFIED (not traced) — two project settings that disable guards leave doctor green.
- Scope Auditor: FAILED (not found) — the disabled-guard row misses the Cursor kill switch and MEOWKIT_HOOK_PROFILE=fast; row widened.
- Contract Verifier: no test asserts the `detail` key; test added to this phase.

## Next Steps

- Follow-up: guidance text for the model when two workflows disagree (belongs to the skills plan).
- Validated 2026-11-15: plugin directories are scanned only with an explicit flag; the kill switch is env-only.

## Validation Log

Whole-Plan Consistency Sweep — 2026-11-15T11:48:08+07:00: 12 deltas checked, 0 reconciled, 0 unresolved. Answers: [validation-log.md](validation-log.md).
