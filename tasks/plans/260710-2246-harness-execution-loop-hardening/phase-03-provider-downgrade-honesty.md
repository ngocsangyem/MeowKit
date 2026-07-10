---
phase: 3
title: "Provider Downgrade Honesty"
status: pending
effort: "M"
priority: P1
dependencies: [2]
---

# Phase 3: Provider Downgrade Honesty

## Overview

Provider conversion can keep files while losing enforcement: transforming the shipping `settings.json` for Codex drops 7 of 22 hook registrations — including the Edit/Write pre-hooks that carry Gate 1 and privacy blocking (`allowedMatchers: ["Bash"]` in `codex/capabilities.ts:94-105`; drop in `claude-to-codex-hooks.ts:55-69`). Much of the reporting machinery already exists; this phase makes the loss **impossible to miss**: golden tests on shipping fixtures, an explicit policy when critical enforcement drops, truthful provider summaries, and drift-checked plugin payloads.

## Key Insights (verified)

- 22 → 15 reproduces exactly against current source with the real `settings.json`; dropped: 3 PreToolUse (Edit|Write ×2, Read ×1), 3 PostToolUse (Edit|Write), 1 PostToolUseFailure (event unsupported).
- Reporting already exists and should be built on, not duplicated: `emitEventAndMatcherRecords()` (`hooks-settings-merger.ts:501-530`) emits `event-unsupported`/`matcher-narrowed`; `hookRecord()` (`hooks-settings-merger.ts:469-487`) prefixes `gate-enforcement.sh`/`privacy-block.sh` with `CRITICAL (never-prune safety hook)`; report writer renders a "Needs attention" section.
- **Gap:** nothing *blocks or requires acknowledgement* when critical enforcement is dropped — the migrate run still completes normally.
- Migration E2E tests are synthetic: `buildKitInstallHookRegistrations()` (`migrate-e2e-harness.ts:122-145`) uses only Bash/no-matcher groups, so its "22 survive" assertion tests a scenario that cannot occur with the shipping settings. The real 7-drop path has zero test coverage.
- Role/enforcement vocabulary already exists: `ProviderHarnessRole` (7 values) and `EnforcementLevel` (hard/candidate/advisory/unsupported) in `provider-support-summary.ts:7-16`, computed by `classifyProviderRole()`/`summarizeEnforcement()`.
- Native Codex plugin manifest exposes **skills only** (`buildCodexPluginJson()`, `plugin-manifest.ts:106-125`) — a different, narrower surface than `migrate codex`, with no published parity statement. <!-- Updated: Validation Session 1 - pursue parity --> **User decision (validation 2026-07-10): pursue parity** — the native plugin build is extended toward the migrate path's surface (agents/commands/hooks wherever the Codex capability table allows), rather than staying skills-only.
- CI validates committed plugin manifests (`checkPluginManifests()`) but never regenerates and diffs the payload; `checkSubstrate()` (`substrate.ts:194-210`) shows the regenerate-and-diff pattern to reuse.

## Requirements

- Functional: golden transform tests from shipping `settings.json` for Claude and Codex; migrate-time policy on critical enforcement loss (fail, or proceed only with explicit acknowledge flag); provider summaries state enforcement coverage ("surface present, enforcement reduced"), not just enabled surfaces; native Codex plugin extended to capability-table parity with the migrate path (shared converters), with a per-provider parity statement of achieved coverage + remaining gaps; deterministic regenerate-and-diff CI for the plugin payload.
- Non-functional: no weakening of conversions to make tests pass; report wording product-name-free; policy must not block providers where the loss is non-critical.

## Related Code Files

- Modify: `packages/mewkit/src/migrate/hooks/hooks-settings-merger.ts` (loss policy hook-in), `packages/mewkit/src/migrate/validation/migration-report-writer.ts` (enforcement-coverage section), `packages/mewkit/src/migrate/provider-support-summary.ts` (expose coverage delta per conversion), `packages/mewkit/src/core/plugin-manifest.ts` + plugin payload builder (Codex surfaces beyond skills, via migrate converters), `packages/mewkit/src/core/check-plugin-manifests.ts` or new `check-plugin-freshness.ts` (regenerate-and-diff), `.github/workflows/ci.yml`, migrate CLI arg parsing in `packages/mewkit/src/index.ts` (acknowledge flag).
- Create: golden fixtures directory holding a copy-synced snapshot of shipping `.claude/settings.json` + expected per-provider transform outputs; tests `migrate/__tests__/shipping-settings-golden.test.ts`; parity statement doc generated per provider (fed from support summary; surfaced by `providers` command).
- Delete: nothing — synthetic fixtures stay for their own scenarios but lose their "canonical" role.

## Implementation Steps

1. **Tests first:** golden test that transforms the shipping `settings.json` per provider and asserts exact preserved/dropped/degraded sets (Codex expects 15 preserved, 6 matcher-narrowed, 1 event-unsupported; update expectations only through explicit fixture review). A CI guard keeps the fixture byte-identical to `.claude/settings.json` so it cannot silently rot.
2. Classify each registration's enforcement criticality (reuse the never-prune safety list; extend to a declared `enforcement: hard|advisory` field in the hook manifest from Phase 2).
3. Loss policy: when a `hard`-enforcement registration is dropped or narrowed, `migrate` exits non-zero with a summary. The escape hatch is **scoped, not blanket** (red team): `--acknowledge-degraded-enforcement=<fingerprint>` where the fingerprint is a hash of the exact drop-set being acknowledged (printed by the failing run). A different or larger drop-set fails again even with the old flag value — a flag baked into CI cannot silently bless future losses. Acknowledgements are recorded in the migration report.
4. Extend the report and `providers` summary with an enforcement-coverage line per event (e.g. "PreToolUse: 3/6 registrations preserved; source-write gating NOT enforced on this provider").
5. Bring the native Codex plugin toward migrate-path parity: extend `buildCodexPluginJson()`/payload generation to carry every surface the Codex capability table supports (skills + the convertible agents/commands/hooks), reusing the migrate converters — one conversion implementation, two packaging paths. Then publish parity statements per provider stating achieved surface coverage and the *remaining* gaps (e.g. matcher-narrowed hooks) — rendered by the `providers` command and included in plugin build output.
6. Plugin freshness: `build-plugin` in a temp dir + diff against committed `plugin/`; wire into `validate --plugin` and CI, mirroring the substrate pattern.

## Success Criteria

- [ ] Shipping-settings golden tests pass for Claude (identity) and Codex (15/6/1 split) and run in CI.
- [ ] Migrating to a provider that loses Gate 1/privacy enforcement fails without the acknowledge fingerprint; a changed drop-set invalidates a previously supplied fingerprint; report records acknowledgements.
- [ ] `providers` output states enforcement coverage per event, and the Codex summary no longer reads as "hooks supported" without qualification.
- [ ] Native Codex plugin carries every surface the capability table supports (not skills-only), built through the same converters as `migrate codex`; parity statement documents achieved coverage + remaining gaps for every provider with both paths.
- [ ] CI fails when committed `plugin/` payload differs from a fresh regeneration.

## Risk Assessment

- **Parity scope growth (accepted by user decision):** plugin parity adds real work to this phase; contain it by reusing the migrate converters verbatim — if a surface needs new conversion logic, it is a capability-table gap to record, not ad-hoc plugin code.

- **Golden fixtures rot as settings evolve:** the byte-identity CI guard turns rot into an immediate, attributable failure.
- **Policy breaks existing automated migrate flows:** flag-gated escape hatch preserves automation while making degradation an explicit, logged decision.
- **Codex capability table may lag upstream Codex releases** (audit open question #1): table is versioned per Codex release already; treat new matcher support as a table update + golden expectation change, not code change.
