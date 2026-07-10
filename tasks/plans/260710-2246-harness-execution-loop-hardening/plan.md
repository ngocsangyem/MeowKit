---
title: "Harness Execution-Loop Hardening: State, Evidence, Gates, Provider Honesty"
description: "Close the intent → active plan → phase → action → verification → result → resume loop; make enforcement, provider downgrade, and capability wiring machine-readable and honest."
status: pending
priority: P1
branch: ""
tags: [harness, state, evidence, gates, providers, inventory]
blockedBy: []
blocks: []
created: "2026-07-10T15:46:52.333Z"
createdBy: "ck:plan"
source: skill
---

# Harness Execution-Loop Hardening: State, Evidence, Gates, Provider Honesty

## Overview

Source: [plans/reports/260710-meowkit-agentic-harness-architecture-audit.md](../reports/260710-meowkit-agentic-harness-architecture-audit.md) (approved audit, source/test/runtime-verified).

The toolkit has a real control plane (CLI, Claude hooks, memory/wiki, migration, plugin build) but is not yet a coherent agentic harness: key state has readers without producers, Gate 1 is weaker than its wording, verification evidence is unscoped, provider conversion silently drops enforcement (22 → 15 hook registrations on Codex), and there is no capability registry. This plan closes the runtime evidence loop **first** (audit §10: it is the dependency for status, Gate 2, continuity, and anti-hallucination), then hardens gates, provider honesty, discoverability, wiring, and portability — with an end-to-end validation matrix last. No catalog expansion (no new skills/agents/commands) until the loop is closed.

**Global constraints (apply to every phase):**

- **Generic wording:** all authored artifact content (schemas, hook messages, skill/rule text, docs, error strings, field names) must be project-agnostic — describe the harness role ("the toolkit", "the harness"), never a product name. Existing self-references touched by a phase are rewritten, not extended.
- **Authority order:** Markdown plans/checkboxes stay canonical; JSON is compact derived state; SQLite only ever a derived index. State conflicts always lose to canonical Markdown.
- **TDD for state/evidence/gate changes** (audit §10): producer/contract tests written first; fixtures are canonical shipping artifacts, not synthetic stand-ins.
- **No context garbage:** inject pointers (active plan, phase, top blockers, next action), never raw logs/traces.
- **Claims cleanup:** any claim without a runtime producer/consumer ("auto-run", "approved plan", "hard Gate 2", "autosave every 5 min") is fixed or downgraded in the same phase that touches its subsystem.
- **Threat model (red team):** gates and state constrain a *cooperative-but-fallible* agent — every gate input (`tasks/plans/*`, `tasks/reviews/*`, session state) is writable by the session it constrains. This is guardrail engineering against forgetfulness and hallucination, not a security boundary against a malicious agent. Captured (never self-reported) evidence and content-parsed verdicts raise the cost of *accidental* bypass; the residual "producers are prose-executed and skippable" risk is accepted and documented, with gate consumption (Phase 2) making skips visible.
- **Reuse before build:** existing primitives are the default — `shared-state.cjs` (atomic state I/O), `core/file-lock.ts` (locking), `verdict-gate` CLI (verdict evaluation), `doctor-checks.ts` vetted-probe pattern, substrate regenerate-and-diff pattern. New parallel implementations of these are out of scope.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [State & Evidence Loop Core](./phase-01-state-evidence-loop-core.md) | Pending |
| 2 | [Gate & Hook Lifecycle Integrity](./phase-02-gate-hook-lifecycle-integrity.md) | Pending |
| 3 | [Provider Downgrade Honesty](./phase-03-provider-downgrade-honesty.md) | Pending |
| 4 | [Inventory as Capability Authority](./phase-04-inventory-as-capability-authority.md) | Pending |
| 5 | [Command & Workflow Wiring](./phase-05-command-workflow-wiring.md) | Pending |
| 6 | [Model-Agnostic Core-Adapter Split](./phase-06-model-agnostic-core-adapter-split.md) | Pending |
| 7 | [End-to-End Validation Matrix](./phase-07-end-to-end-validation-matrix.md) | Pending |

## Dependencies

- **Phases 1 + 2 ship as one release train** (red team: a live Stop-side gate with an unscoped write-side gate is worse than neither; the verification-required producer is inert unless the Phase 2 gate logic is present).
- Phase 1 blocks 2–7 (state writer + evidence envelope are the shared contract).
- Phase 3 depends on 2 (parity tests need the final hook set). Phase 4 depends on 1 **and 2** (hook inventory entries source producer/consumer/enforcement from the Phase 2 manifest generator). Phases 3 and 4 can run in parallel after 2.
- Phase 5 depends on 1 and **4** (command intent fields extend Phase 4's inventory entries — no standalone registry).
- Phase 6 depends on 1–3 (relocation + declarations over stabilized surfaces).
- Phase 7 depends on all prior phases; per-phase TDD tests land inside each phase, Phase 7 adds only cross-phase E2E scenarios and gap-fill entrypoint tests.

## Acceptance (plan-level)

- Kill/resume drill restores plan, phase, blockers, next action from compact state; stale/unapproved/wrong-slug plans do not unlock writes.
- Unscoped or empty/rejected verdicts cannot close a plan or satisfy Gate 2.
- Provider conversion reports preserved/dropped/degraded registrations; critical enforcement loss warns or fails, never silent.
- `inventory --check` and `validate --substrate` pass; counts/docs generated from inventory; capability query works for equipped tools.
- Canonical shipping `settings.json` passes golden transform tests for Claude and Codex.

## Out of Scope (audit §6/§10 "do not copy")

Full Symphony runner, dual canonical SQLite, Codex `danger-full-access`/`approvalPolicy: never` defaults, self-reported verification as proof, repo-specific context heuristics, TCP-reachability-as-health.

## Red Team Review

### Session — 2026-07-10
**Reviewers:** Security Adversary (Fact Checker), Failure Mode Analyst (Flow Tracer), Assumption Destroyer (Scope Auditor), Scope & Complexity Critic (Contract Verifier). Reports in [`reports/`](./reports/).
**Findings:** 28 raw → 26 after dedup; 15 major accepted (table), 11 minor corrections accepted inline, 0 rejected (all passed the file:line evidence filter).
**Severity breakdown:** 7 Critical, 8 High (majors); rest Medium minors.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Gates are self-attested (same-session-writable inputs); verdict check was filename-existence only | Critical | Accept — explicit threat model + content-parsed verdicts | plan.md, Phase 2 |
| 2 | RESULT envelope trusted caller-supplied `exit_code`/`artifact_hash` (self-reported verification) | Critical | Accept — CLI executes/wraps the command and computes evidence itself | Phase 1 |
| 3 | Data-driven probe commands in Gate-1-exempt inventory JSON = command injection | Critical | Accept — vetted hardcoded probe table in source | Phase 4 |
| 4 | active-run read-modify-write had no locking despite in-repo `file-lock.ts` precedent | Critical | Accept — lock all mutating writers | Phase 1 |
| 5 | Single global active-run breaks permitted parallel same-checkout sessions | Critical | Accept — session-scoped run files | Phases 1, 2, 7 |
| 6 | "Enforcement backstop" claim false for `phase`/`blockers`/`decisions`; producers skippable | Critical | Accept — reclassified as continuity data; residual risk documented | Phases 1, 2, plan.md |
| 7 | Phase 5 command registry duplicated Phase 4 inventory for the same 46 surfaces | Critical | Accept — intent fields extend inventory entries; no registry file | Phases 4, 5 |
| 8 | New state module duplicated `shared-state.cjs`; hooks gained undefined CLI runtime dependency | High | Accept — extend `shared-state.cjs`; hooks read-only; doctor probe | Phase 1 |
| 9 | `verdict-gate` CLI already implements Zod verdict evaluation (used by review step-04) | High | Accept — reuse; no new parser | Phase 2 |
| 10 | Active-plan resolution already fragmented 3 ways; orchviz left on mtime heuristic | High | Accept — converge on active-run-first resolution | Phase 1 |
| 11 | "Markdown wins" conflict rule had no defined algorithm | High | Accept — deterministic derivation + stale marking, tested | Phase 1 |
| 12 | Corrupt/unparseable active-run behavior unspecified at a hard gate | High | Accept — documented fallback + warning, tested | Phase 2 |
| 13 | Mid-rollout asymmetry: Stop-gate live before write-gate scoped | High | Accept — Phases 1+2 one release train; producer inert without Phase 2 | Phases 1, 2, plan.md |
| 14 | `--acknowledge-degraded-enforcement` was an unscoped permanent bypass | High | Accept — drop-set fingerprint; new losses re-fail | Phase 3 |
| 15 | Trace corpus "drives adherence scoring" but no phase builds a scorer | High | Accept — cut/deferred until a consumer exists | Phase 7 |

**Minor corrections applied:** normalized paths in deny messages; attempts counter keyed `(plan_slug, run_id)`; corrected overstated "unscoped evidence" claim (3 of 4 checks already slug-scoped); RESULT `results/` gitignored + retention cap; Phase 4 dependency on 2 declared; substrate tag deadline enforced by version constant; capability-reference migration scoped to touched skills; Phase 6 trimmed to relocation + declarations; Phase 7 entrypoint tests gap-fill only; grep producer checks labeled drift-detection (runtime proof = E2E); generated authorities consolidated under the inventory.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01 … phase-07 (all).
- Decision deltas checked: 10 (session-scoped state, no command registry, manifest→inventory, trace-corpus cut, captured evidence, verdict-gate reuse, hooks-read-only, release train, acknowledge fingerprint, gap-fill tests).
- Reconciled stale references: 4 (Phase 7 scenario 7 + entrypoint wording; Phase 2 evidence wording; sweep-found contradiction: verification-required session-scoped to match active-run — fixed in Phases 1–2).
- Unresolved contradictions: 0.

## Open Questions — RESOLVED (validation interview, 2026-07-10)

1. **Gate 1 approval default** — ✅ User decision: **default ON at next release**. This release warns on unapproved plans; next release blocks by default (env-flag opt-out retained); flip enforced by a version constant (Phase 2).
2. **Native Codex plugin parity** — ✅ User decision: **pursue parity**. Plugin build extends to every surface the Codex capability table supports, reusing the migrate converters (Phase 3).
3. **Codex non-Bash matchers** — resolved by default (no counter-evidence): assume none; versioned table + golden expectations absorb future changes (Phase 3).
4. **Durable runner** — ✅ User decision: **out of this plan; thin queue recorded as follow-up stub** → [`plans/260710-2323-thin-isolated-run-queue/`](../260710-2323-thin-isolated-run-queue/plan.md). Only the run contract/RESULT envelope ships here (Phase 1).

Remaining open questions: **None.**

## Validation Log

### Session 1 — 2026-07-10
Verification pass: satisfied by the Red Team Review's evidence (guard rule) — 4 reviewers, all cited claims VERIFIED, 0 `[UNVERIFIED]` tags. Interview: 4 questions asked, 4 decisions recorded.

| # | Question | Decision | Propagated to |
|---|----------|----------|---------------|
| 1 | Gate 1 approval default | Default ON next release (warn → block window, version-gated) | Phase 2 steps/criteria/risks |
| 2 | Codex native plugin surface | Pursue parity via shared migrate converters | Phase 3 insights/steps/criteria/risks |
| 3 | Durable runner boundary | Out of scope; follow-up stub created | Stub plan `260710-2323-thin-isolated-run-queue` |
| 4 | `/validate` name collision | Rename slash command; deprecated alias one release | Phase 5 (already as planned — confirmed) |

### Whole-Plan Consistency Sweep (post-validation)
- Files reread: plan.md, phase-01 … phase-07.
- Decision deltas checked: 4 (approval default flip, plugin parity, queue stub, rename confirmation).
- Reconciled stale references: 2 (Phase 2 approval-risk row; Phase 3 skills-only framing in insights/criteria).
- Unresolved contradictions: 0. Plan is eligible for implementation (verification failures: 0).
