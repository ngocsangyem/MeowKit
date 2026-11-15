---
title: "MeowKit runs without approval gates, keeps a real ship check, and reports toolkit conflicts"
type: refactor
status: approved
priority: high
effort: xl
created: 261115
model: refactor-model
blockedBy: []
blocks: []
consistency_sweeps:
  red_team: { reconciled: 3, unresolved: 0, ran_at: 2026-11-15T11:32:25+07:00 }
  validation: { reconciled: 0, unresolved: 0, ran_at: 2026-11-15T11:48:08+07:00 }
handoff:
  next: end
  decided_at: 2026-11-15T11:51:53+07:00
approval:
  approved_by: human
  date: 2026-11-15
  plan_hash: 494162ffc24d207fa2ca33f29168b7f19e30e58c93304d7ee6cda5ddc377a3db
---

# MeowKit runs without approval gates, keeps a real ship check, and reports toolkit conflicts

## Goal

On Claude Code, Codex and Cursor, a MeowKit install lets an agent edit source without a plan-approval or review-approval gate; on all three it still refuses a commit or push when lint, type-check or the tests related to the changed files fail; the model is told when edits are unverified; documentation states per runtime what is enforced; and `mewkit doctor` reports conflicts with other installed toolkits and drift in the guard files.

## Context

- Three hooks block today: plan gate, privacy block, ship check. The plan gate is skipped by Bash writes, its documented exceptions are not implemented, and approval is self-stampable (from: research/plan-intake-packet.md).
- Gate text sits in 126 files across 37 skills, 13 agent definitions and 3 rule files on Claude Code, and in 123 and 112 bundle files (from: research/scout-scope-map.md).
- The Codex and Cursor bundles are hand-authored; only 10 hook lib files are script-synced (from: research/researcher-01-bundle-provenance-and-sync.md).
- `doctor` already has check rows, both scopes and a hook ownership index (from: research/researcher-02-cli-gate-surface-and-doctor.md).

## Phases

| # | Phase | Status | Effort | Depends On |
|---|-------|--------|--------|------------|
| 1 | [Guard self-test and host probes](phase-01-guard-self-test-and-host-probes.md) | Pending | 2d | — |
| 2 | [Remove gate mechanisms, standalone ship check](phase-02-remove-gate-mechanisms-standalone-ship-check.md) | Pending | 8d | Phase 1 |
| 3 | [Gate-free, model-fit instructions on three runtimes](phase-03-gate-free-model-fit-instructions.md) | Pending | 9d | Phase 2 |
| 4 | [Output validation without gates](phase-04-output-validation-without-gates.md) | Pending | 3.5d | Phase 2 |
| 5 | [Coexistence report in doctor](phase-05-coexistence-report-in-doctor.md) | Pending | 3d | Phase 2 |

## Acceptance Criteria

- [ ] A source `Write` with no plan directory is allowed by every registered hook; a commit that stages a lint error or a failing related test exits 2 on each runtime.
- [ ] `node scripts/check-instruction-criteria.cjs .claude kit/bundles` exits 0 (no instruction to obtain or wait for an approval gate).
- [ ] `npx vitest run tests/guards` (three runtime fixtures), `npm test`, `cargo test --workspace --locked` and `mewkit validate` exit 0.
- [ ] `mewkit doctor --json` contains `coexistence` rows on a fixture with a second toolkit installed.
- [ ] Upgrade tests on three runtimes leave no gate hook file or registration, including a hand-edited settings fixture.
- [ ] `npx vitest run tests/hooks/completion-gate.test.ts` exits 0; `docs/core/enforcement-matrix.md` exists.
- [ ] `test -d docs/plans/261115-remove-gates-audit-runtimes-coexistence && ! test -e tasks/plans/261115-remove-gates-audit-runtimes-coexistence` succeeds.

## Constraints

- Do NOT remove or weaken `privacy-block` or the test, lint and type-check run at ship time; do NOT regenerate frozen golden recordings (hand-edit with a reason in `DIVERGENCES.md`).
- Out of scope: body audit of the 128 skills (second plan), orchestration runtime, observability backend, vector memory, new hosts, an eval verb.
- MUST keep `bundled` hook lib files byte-identical across the three trees, rules under the always-on ceiling, and `doctor --json` row shape stable.
- MUST land every pull request on one integration branch; `main` receives a single merge after Phase 4 is green; no release cut; MUST leave `tasks/` and `.meowkit/` free of work artefacts at the end (this plan directory moves to `docs/plans/`).

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Gate libs deleted while `pre-ship` or the completion check still import them | M | H | Phase 2 rewires both first; Phase 1 suite catches it |
| Three hand-maintained trees drift during the sweep | H | M | Edit `.claude/` first, port as diffs, run `sync-hook-core.cjs --check` and `validate --target` |
| Agents edit out of scope once the accident guard is gone | M | M | Accepted residual risk by maintainer decision; `doctor` integrity row and the optional host profile detect and limit it |
| Existing installs keep stale gate hooks after upgrade | M | H | Upgrade test per runtime (files retire by ownership-index diff) |

## Autonomy Boundaries

Baseline rules always apply; below is only the extra latitude for this plan.

- **Always (autonomous):** names of test fixtures and Rust check rows; order of edits inside a phase; wording of reworded gate text that passes the audit criteria.
- **Ask first:** deleting a skill or agent; changing `doctor --json` shape; spending on headless model runs; removing the Cursor kill switch; any change to a `privacy-block` decision.
- **Never:** see `.claude/rules/security-rules.md` and `.claude/rules/gate-rules.md` (in force until Phase 2 merges).

## User-Confirmed Decisions

- Both gates removed, ship check kept (option A); audit covers Claude Code, Codex and Cursor — `locked: user-confirmed`
- Coexistence lives in `doctor`; self-test is a repo regression test; skills body audit is a second plan; model-fit audit of rules and agents and the mechanical fixes stay as separate pull requests; guard-file drift is a `doctor` integrity check — `locked: user-confirmed`
- Ship check on all three runtimes, scoped to changed and related files (lint and type-check only when related tests cannot be named), ignoring the fast profile; completion check opt-in, on three runtimes; Cursor kill switch env-only and never disabling privacy; fail-closed on `privacy-block` only — `locked: user-confirmed`

## Red Team Review

Session 2026-11-15: 15 findings (1 Critical, 12 High, 2 Medium), all accepted, four in the form the maintainer chose; 1 cross-persona blind spot promoted. Dispositions, sweep edits and mutation log: [red-team-findings.md](red-team-findings.md). Validation interview (7 answers): [validation-log.md](validation-log.md).

## Agent State

Approved by: human (Gate 1, 2026-11-15; revised after the runtime-docs triage and re-approved the same day). Validation: approved. Not started; next is Phase 1. Phases 1 and 2 run under the current gates.
