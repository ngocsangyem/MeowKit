# Plan Intake Packet: remove-gates-audit-runtimes-coexistence

Research root: `docs/research/meowkit-evolution-2611/` (abbreviated `R/` below). Baseline `main` @ `c7ff0a9e`.

## Request
- Raw request: remove both gates (option A), audit rules, hooks and agents for model fit on all three runtimes, add a coexistence report to `mewkit doctor`; plan with `mk:plan-creator --deep`.
- Desired output: a kit with no plan-approval or review-approval gate, a standalone ship check that still runs test, lint and type-check, output validation that works without gates, audited rules/hooks/agents on Claude Code, Codex and Cursor, a guard self-test in the repo, and a coexistence section in `doctor`.
- Constraints:
  - `tasks/` and `.meowkit/` ship in the kit; no work artefacts left there at the end — from: user memory `packaging-dirs-left-clean`
  - Work on a feature branch, not `main` — from: `.claude/rules/development-rules.md`
  - Rules stay under the always-on ceiling (25,420 B of 25,600 B today) — from: `R/findings/D03-agents-workflow-context.md`
  - Gate-core lib files must stay byte-identical across the three bundles (`sync-hook-core.cjs --check`) — from: `R/06-cli-and-adapter-architecture.md`
  - Fail-closed hook configuration needs host 2.1.295+ and does not cover Stop-class events — from: `R/findings/R2-critical-review-citations.md`
- Non-goals: orchestration runtime, observability backend, vector memory, new hosts, removing or merging skills/agents on judgement alone, an eval verb in the CLI — from: `R/13-prioritized-engineering-roadmap.md`

## Routing
- Recommended mode: hard (via mk:scale-routing: domain `cli`, level medium, workflow standard, task_type refactor, confidence MEDIUM, autobuild_density FULL)
- Conflict: plan-creator classified complex → deep (user passed `--deep`; 5+ directories). scale-routing's table has no row for security-control changes, so its `medium` understates the risk of removing guards. Deep stands.

## Requirements
- Functional:
  - Remove the plan gate: `gate-enforcement.cjs`, `lib/core/plan-gate.cjs`, `lib/gate1-path-rules.cjs`, `lib/approval-receipt.cjs`, the contract check, and their registration — from: `R/evidence-ledger.md` M-1
  - Remove the Gate 2 verdict/approval check; keep `pre-ship.cjs` running test, lint and type-check on commit and push — from: `R/evidence-ledger.md` M-1
  - Ship trigger must catch `git  commit`, `git -C . commit`, `git -c x=y commit`, aliases, `gh pr create`, `gh pr merge` — from: `R/findings/R1-critical-review-source-claims.md` claim 4
  - `pre-completion-check` actually runs (its condition file is written by nothing today) — from: `R/findings/D01-hooks-rules-gates-security.md`
  - `build-verify`, budget and loop output reach the model or are labelled advisory — from: `R/07-observability-and-evaluation-architecture.md` O-01, O-10
  - Privacy-block and post-write scanner gaps closed — from: `R/08-security-and-authority-assessment.md` S-06, S-07
  - Rules, hooks and agents audited against fixed criteria on `.claude/`, `kit/bundles/codex`, `kit/bundles/cursor` — from: `R/evidence-ledger.md` M-2 (skills body audit deferred, see Scope Shape)
  - Guard self-test as a repo regression test on all three runtimes — from: `R/12-controlled-experiment-plan.md` E8
  - `doctor` coexistence report: same-name agents, overlapping rule topics, other toolkits' hooks on the same events, skill-listing budget pressure — from: user, this session
  - Mechanical fixes that survive gate removal: density single source, tier rule vs pinned agents, budget unit mismatch, dead path references and checker, tracked temp files, deprecated skill — from: `R/05-skill-agent-rule-hook-audit.md` C-03, C-04, C-05, C-12, C-13
- Non-functional:
  - Docs and CLI output must not claim a gate that no longer exists — from: `R/08-…` §7
  - Every phase leaves `npm test`, hook tests and `cargo test` green — [ASSUMPTION]
- Acceptance criteria (binary, from sources):
  - A source `Write` with no plan succeeds; a failing test still blocks `git commit` — from: `R/findings/R1-…` claims 1, 4
  - All six ship-trigger evasions are caught — from: `R/findings/R1-…` claim 4
  - Selector, detector and doc agree on density for every listed model id — from: `R/03-foundation-model-research.md` M-01
  - `doctor` turns non-green when a guard is disabled by project config — from: `R/06-…` K-04
- User-confirmed decisions (LOCKED):
  - Option A: both human gates removed, pre-ship kept — user, 2026-11-15
  - Audit covers all three runtimes — user, 2026-11-15
  - Coexistence goes into `doctor`; self-test is a repo regression test, not a user verb — user, 2026-11-15
  - Scope mode HOLD: skills body audit (128 × 3 runtimes) becomes a second plan — user, 2026-11-15

## Evidence
- Sources:
  - `R/evidence-ledger.md` — environment, baseline change, maintainer decisions M-1, M-2
  - `R/13-prioritized-engineering-roadmap.md` — ordered items; rows R-03, R-05, R-11, R-12 are moot after M-1
  - `R/findings/R1-critical-review-source-claims.md` — re-run source claims; authoritative over D01–D05
  - `R/08-security-and-authority-assessment.md` — enforcement classification, S-mitigations
  - `R/05-skill-agent-rule-hook-audit.md` — per-hook, per-rule, per-agent classification, C-items
  - `R/06-cli-and-adapter-architecture.md` — Rust CLI, per-host truth table, K-items
  - `R/02-source-level-architecture-audit.md` — mechanism table, runtime flow
  - `R/07-observability-and-evaluation-architecture.md` — signal defects, O-items
  - `R/12-controlled-experiment-plan.md` — E8 enforcement suite, probes P1–P8
- Unknowns:
  - Does plain hook stdout reach the model (docs say no; untested live)
  - Hook timeout and `onFailure` behaviour on this host version
  - Guard reach on MultiEdit / NotebookEdit
  - How the Codex and Cursor bundles are produced: hand-edited or emitted from a source (0 of 125 and 0 of 124 `SKILL.md` are byte-identical to `.claude/skills`)
  - Which CLI code reads plan/approval/verdict state (`plan approve`, `validate --gates`, `orient`, `task-state`)

## Scope Shape
- Likely files/areas: `.claude/settings.json`, `.claude/hooks/**`, `.claude/rules/*.md`, `.claude/agents/*.md`, `.claude/skills/{cook,plan-creator,review,ship,fix,agent-detector,autobuild}`, `kit/bundles/{codex,cursor}/root/**`, `crates/mewkit-{core,cli,adapters}`, `CLAUDE.md`, `README.md`, `docs/core`, `tests/hooks`
- Risk areas: removing guards without replacing the accident protection; three hand-maintained bundles drifting; skills and agents that instruct the model to wait for a gate that is gone; tests and `validate` checks that assert gate presence; Rust parity recordings frozen against the old behaviour
- Phase granularity hint: 5 phases (HOLD)

## Handoff
- Suggested plan-creator mode: deep
- Follow-up questions:
  - Do plan files (`tasks/plans/`) and `mk:plan-creator` stay as an optional planning aid once no hook requires them?
  - Does `mewkit plan approve` get removed, or kept as a no-op for compatibility?
  - What replaces the accident guard for edits under `.claude/` and outside the project?
  - Is `onFailure: "block"` wanted on the remaining guards given the host-version floor?
- Assumptions allowed: research findings marked VERIFIED and confirmed by R1 are true at `c7ff0a9e`; the Rust `mewkit` is the only CLI; no release is cut by this plan.
