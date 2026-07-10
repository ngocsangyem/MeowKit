---
phase: 6
title: "Model-Agnostic Core-Adapter Split"
status: pending
effort: "M"
priority: P2
dependencies: [1, 2, 3]
---

# Phase 6: Model-Agnostic Core-Adapter Split

## Overview

Separate generic core contracts from provider-specific rendering so the toolkit stops implicitly claiming universal-runtime parity while being authored against one host. The adapter architecture already exists for migration (16 provider contracts); this phase extends the same discipline to the new state/evidence/gate/command contracts from Phases 1–5 and makes each provider's actual role explicit and published.

**Scope trim (red team):** Phases 1–5 already author their schemas host-neutrally (plan-level constraint), so this phase is **not** a re-authoring pass. It is: (a) relocate contracts into `core/contracts/` where they aren't already, (b) provider role/enforcement-coverage declarations, (c) capability-table extension for the new capabilities, (d) degrade-or-block install behavior. Nothing else.

## Key Insights (verified)

- 16 providers registered (`migrate/providers/index.ts:57-73`); capability contract types in `contract-types.ts:31-36`; `ProviderHarnessRole` (7 values incl. full-harness/procedure/policy-advisory/config-only/disabled) and `EnforcementLevel` already computed by `provider-support-summary.ts:139-161` — the vocabulary exists; it is not yet a published, per-install declaration nor applied to the new contracts.
- Host-specific bindings identified by the audit (§7): `.claude/` as canonical authored surface, `$CLAUDE_PROJECT_DIR`, host event/tool matcher names, slash/agent frontmatter formats, plugin namespace/payload shape, model tier names, behavioral assumptions about host tools.
- Generic-already parts to preserve untouched: provider contract type system, pure conversion/reconciliation, artifact ownership/checksum/update model, workflow phase schema, JSON/JSONL + derived-index principle, wiki layering, evidence labeling.
- Audit "keep in core": artifact identity/ownership/checksum, run/plan/session IDs, state machine + evidence envelope, capability requirements + downgrade semantics, secret classification/redaction, validation result schema.
- Audit "optional modes": orchviz, third-party integrations (issue trackers, design tools, browser), durable queue/runner, SQLite indexes for small projects, parallel worktree orchestration.

## Requirements

- Functional: core contracts (phase/gate/evidence schema, capability + required enforcement, agent role + allowed effects, command intent, context request, verification result) defined host-neutrally in the CLI package; adapters own mapping to host paths/surfaces/formats/deny semantics; each provider publishes a role + enforcement-coverage declaration at install/migrate time; unsupported capabilities degrade explicitly or block install — never silent copy; optional modules declared optional in inventory.
- Non-functional: `.claude/` remains the authored source for the primary host (audit "keep" list) — no forced universal folder rename; zero behavior change on the primary host; new schemas contain no host or product names in field values.

## Related Code Files

- Modify: `packages/mewkit/src/core/session-state/` + evidence envelope schemas (audit for host-specific leakage; extract constants), `packages/mewkit/src/migrate/providers/*/` (map the new contracts: state file locations, gate deny protocol, context injection mechanism, verification capture method per provider), `provider-support-summary.ts` (declaration output includes the new contract coverage), `packages/mewkit/src/commands/init.ts`/`migrate` flow (install-time role declaration + degrade/block behavior), inventory entries (`optional: true` for orchviz/integrations/worktree/etc.).
- Create: `packages/mewkit/src/core/contracts/` (host-neutral schema module: command intent, context request, verification result, agent role), per-provider role declaration artifact generated into the install (consumed by `providers` and `doctor`).
- Delete: none; refactors move definitions, imports keep compatibility.

## Implementation Steps

1. **Tests first:** contract schemas round-trip host-neutrally; a fake minimal provider adapter can render gate deny + state paths + context request without touching host-specific code; unsupported-capability install path blocks or records explicit degradation.
2. Relocate the already-generic Phase 1–5 contract schemas into `core/contracts/` (moves + re-exports, not redesign); adapters (starting with the primary host + Codex) implement the mapping table from the audit (§7 "Nên tách thành adapter").
3. Extend provider capability tables with the new capabilities (`session-state`, `gate-deny`, `context-injection`, `verification-capture`) and their required enforcement levels.
4. Implement install/migrate-time role declaration: provider role + per-capability enforcement coverage written into the installed footprint and shown by `providers`/`doctor`.
5. Enforce degrade-or-block: installing/migrating a capability the provider cannot enforce requires the Phase 3 acknowledge flag or is skipped with a recorded, visible degradation.
6. Mark optional modules in inventory; core install paths must not require them.

## Success Criteria

- [ ] Core contracts live in a host-neutral module with no host/product-specific strings; adapters own every host-specific mapping.
- [ ] Every provider publishes role + enforcement coverage (not just enabled surfaces) at install/migrate time.
- [ ] Unsupported capability → explicit degrade record or blocked install; grep of migration output finds no silent copies of hard-enforcement artifacts to non-enforcing providers.
- [ ] Primary-host behavior unchanged (regression suite green, hard-gate probe passes).
- [ ] Optional modules install/uninstall independently of core.

## Risk Assessment

- **Abstraction for its own sake (YAGNI):** scope is strictly the six contract rows from the audit table; no adapter work for providers with `config-only`/`disabled` roles beyond declaring them.
- **Refactor destabilizes the primary host:** contracts extracted behind existing call sites; primary-host golden tests from Phase 3 must stay green throughout.
- **Second host never materializes, code rots:** the Codex adapter (already needed for migrate) is the proving second consumer; no speculative third adapter.
