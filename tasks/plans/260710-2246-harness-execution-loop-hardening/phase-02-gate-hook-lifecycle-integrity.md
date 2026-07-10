---
phase: 2
title: "Gate & Hook Lifecycle Integrity"
status: pending
effort: "L"
priority: P1
dependencies: [1]
---

# Phase 2: Gate & Hook Lifecycle Integrity

## Overview

Make gate wording match gate behavior, scope Gate 1 and pre-completion to the session's *active run* instead of "any plan file", and give hooks a generated manifest so documented producers/consumers can never drift from wiring again. Consumes the Phase 1 state API; **ships in the same release train as Phase 1** (see Phase 1 overview).

## Key Insights (verified)

- Gate 1 default (`gate-enforcement.sh:105-130`) passes if **any** `tasks/plans/*/plan.md` exists — empty, stale, or unrelated plans unlock source writes. The deny message says "No **approved** plan found", overstating the check.
- Approval enforcement exists but is env-gated (`gate-enforcement.sh:132-163`, `MEOWKIT_GATE1_REQUIRE_APPROVED`, default `0`) and the flag is set nowhere in `settings.json` (env block lines 2–11).
- `workflow.yaml:66-80`: `gate_1` `enforced_by: hook`; `gate_2` explicitly `enforced_by: behavioral`. No runtime reads `workflow.yaml` to drive transitions — it is a spec/drift-check document only.
- **Pre-completion is partially scoped already** (red team correction): `pre-completion-check.sh` slug-scopes its verdict, contract, and evalverdict globs via `$SLUG`; the genuine gaps are (a) no `run_id`/session binding, (b) the trace-log evidence path is unscoped, (c) **verdict evidence is filename-existence only — content is never parsed** (`pre-completion-check.sh:126-131`).
- **Verdict parsing machinery already exists — reuse it, don't rebuild it** (red team): `packages/mewkit/src/commands/verdict-gate.ts` + `verdict-schema.ts` perform Zod-validated, exit-code-driven verdict evaluation and are already used by the review skill (`mk:review` step-04). It is merely absent from CLI help.
- Deny messages echo unnormalized `$FILE_PATH` instead of the already-computed `NORMALIZED_PATH` (`gate-enforcement.sh:59-60`).
- No "verified" Stop sentinel exists; the actual Stop artifact is an unrelated safety/phase-zero sentinel (`post-session.sh:240-254`). Any doc implying verification semantics for it is wrong.
- 22 hook registrations across 9 events in `settings.json` (+ `handlers.json` dispatch); `HOOKS_INDEX.md` is hand-written and already contains false producer claims.
- Audit: `doctor --hard-gates` probes Gate 1/privacy/injection/shell but not the contract gate or verification path.

## Requirements

- Functional: Gate 1 binds to the session's active-run plan slug; wording matches actual semantics; pre-completion requires run-scoped evidence and an affirmative verdict evaluated through `verdict-gate`; Gate 2 becomes hook-enforced via that same machinery; generated hook manifest feeding the inventory (single authority — no standalone registry sprawl); extended doctor probes.
- Non-functional: deny messages actionable, product-name-free, and built from normalized paths; defensive parsing with documented fallback for corrupt state; no new always-on context cost; behavior changes covered by hook tests using shipping `settings.json` shapes.

## Related Code Files

- Modify: `.claude/hooks/gate-enforcement.sh`, `.claude/hooks/pre-completion-check.sh`, `.claude/hooks/post-session.sh` (sentinel doc/comment honesty), `.claude/workflow.yaml` (gate_2 `enforced_by` update once true), `packages/mewkit/src/commands/verdict-gate.ts` (expose for hook-side consumption; add to CLI help — coordinated with Phase 4), `packages/mewkit/src/commands/doctor*` (`--hard-gates` contract + verification probes; mutations behind `--fix`), `.claude/hooks/__tests__/*`.
- Create: `packages/mewkit/src/core/hook-manifest/` generator (reads `settings.json` + `handlers.json` → per-hook records: event, matcher, script, enforcement level, state files read/written) whose output lands in `.claude/harness-inventory.json` entries (Phase 4 consumes the same records); `HOOKS_INDEX.md` becomes generated output.
- Delete: hand-maintained producer/consumer tables in `HOOKS_INDEX.md`.

## Implementation Steps

1. **Tests first** (shell hook tests, shipping-shaped fixtures): stale plan blocks; wrong-slug plan blocks; session's active-run plan allows; **corrupt/malformed active-run degrades to existence check + warning (never repo-wide lockout, never silent hard-block)**; unscoped result rejected; empty/rejected verdict rejected; affirmative verdict passes; manifest matches settings; second session's run does not affect this session's gate.
2. Gate 1: resolve the session's run (session-scoped path from Phase 1). Run active → newest plan must match `plan_slug`, stale-marked runs count as absent. No run → existence check with truthful wording ("a plan file exists" — not "approved"). Deny messages use `NORMALIZED_PATH`.
   <!-- Updated: Validation Session 1 - approval enforcement becomes default at next release -->
   **Approval default (user decision, validation 2026-07-10):** approval enforcement flips to **default ON at the next release**. This release: truthful wording + active-run binding + a *warning* when the gating plan lacks `status: approved`/`Approved by: human`, telling the user how to add it and when blocking starts. Next release: the warning becomes a block by default (opt-out via the existing env flag). Implement the flip with a version constant in the hook config (same mechanism as the Phase 4 substrate deadline) so it is enforced by code, not intention.
3. Pre-completion: resolve the session's verification-required file (session-scoped, Phase 1) and require scope match against the session's run (`run_id`, `plan_slug`); evidence = RESULT envelope with captured `exit_code == 0` and matching scope; verdict evaluated via `verdict-gate` (Zod schema, exit code) instead of filename existence — empty, missing, or negative verdicts block with a specific message. Attempts counter keyed by `(plan_slug, run_id)`; existing slug-only entries expire naturally via the cap.
4. Gate 2: register `verdict-gate` evaluation in the Stop path so `workflow.yaml` can truthfully flip `gate_2.enforced_by: hook`; if not achieved this phase, downgrade every "hard Gate 2" claim in docs/provider summaries instead (claims cleanup rule).
5. Build the hook-manifest generator; regenerate `HOOKS_INDEX.md` from it; CI fails when the manifest drifts from `settings.json`/`handlers.json` or when a documented producer has no write site. (Grep-based producer checks are *drift detection*; runtime proof comes from the Phase 5 E2E fixture and Phase 7 drills — the check must not be sold as more than it is.)
6. Extend `doctor --hard-gates` to probe the sprint-contract gate (`gate-enforcement.sh:165-174`) and the full verification path (producer → state → consumer); doctor without `--fix` is read-only.
7. Claims cleanup in this subsystem: session-continuation "autosave every 5 min/token milestone", "runs first every message" trigger claims — rewrite to describe actual behavior or wire a real producer.

## Success Criteria

- [ ] Stale/unapproved/wrong-slug plan cannot unlock source writes while this session has an active run; sessions are isolated from each other's runs.
- [ ] Corrupt state degrades to the documented fallback with a warning — tested.
- [ ] Gate deny messages describe exactly what was checked and use normalized paths.
- [ ] Unscoped, empty, or negative verdict evidence cannot satisfy pre-completion; scoped affirmative RESULT + `verdict-gate` pass does.
- [ ] No new verdict parser exists — `verdict-gate` is the single evaluation path for review verdicts.
- [ ] `workflow.yaml` gate metadata matches reality (gate_2 hook-enforced, or all "hard Gate 2" claims removed).
- [ ] Hook manifest records generated and CI-checked; `HOOKS_INDEX.md` has zero unverifiable producer claims.
- [ ] `doctor --hard-gates` covers contract gate + verification path; `doctor` without `--fix` is read-only.
- [ ] Unapproved plans produce a migration warning this release; the version-gated default flip to blocking is implemented and tested (flag opt-out still works).

## Risk Assessment

- **Over-strict gates block legitimate quick fixes:** the no-active-run fallback (existence check) keeps single-file fixes possible; strict binding applies only when a run is active in *this* session.
- **Verdict schema variance breaks evaluation:** `verdict-gate`'s Zod schema is the contract; the review skill authors to it already — failures produce explicit messages, not silent passes.
- **Approval-default flip surprises users:** resolved by decision (validation 2026-07-10) — warn-this-release / block-next-release window, actionable warning text, env-flag opt-out retained.
- **Threat-model honesty:** these gates constrain a cooperative-but-fallible agent. All gate inputs (`tasks/plans/*`, `tasks/reviews/*`, session state) are writable by the same session they constrain — this is guardrail engineering, not a security boundary against a malicious agent. Documented in `plan.md`; captured-evidence rules (Phase 1) and content-parsed verdicts raise the effort of accidental bypass, which is the actual goal.
