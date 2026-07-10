---
phase: 4
title: "Inventory as Capability Authority"
status: pending
effort: "L"
priority: P2
dependencies: [1, 2]
---

# Phase 4: Inventory as Capability Authority

## Overview

Grow the existing inventory from a 5-type file census into the machine-readable authority that answers: what capabilities exist, who activates them, what they read/write, how they are enforced, and whether they are currently usable. Extend `build-inventory.ts` — do **not** create a second registry (audit §6). Also clear the currently failing governance checks.

**Consolidation rule (red team):** the inventory is the single generated authority. Phase 2's hook-manifest records and Phase 5's command-intent fields land *inside* `.claude/harness-inventory.json` entries — no standalone `hook-manifest.json`-as-authority, no `command-registry.json`. Depends on Phase 2 because hook entries source `producer`/`consumer`/`enforcement` from its generator.

## Key Insights (verified)

- `ArtifactType` covers only `skill | agent | rule | command | hook` (`build-inventory.ts:14`); hooks enumeration counts top-level `.sh` only — `.cjs` handlers dispatched via `handlers.json` are invisible (`build-inventory.ts:114-122`). Modes, scripts, schemas, workflow, templates, and external tools are absent.
- Entry fields today: `type, path, id, owner, criticality, status, runtime, contextCost?, dependsOn?, responsibility?, surface?, source` (`build-inventory.ts:17-32`). No `capability`, `producer`, `consumer`, `activation`, `enforcement`, `probe`, `checked_at`.
- Live failures reproduce exactly: `inventory --check` → 5 count-drift issues (README skills 119≠124 ×2, rules 25≠26 ×2, SKILLS_INDEX 122≠124); `validate --substrate` → stale `harness-substrate.md` + 160 untagged frontmatter artifacts (`substrate.ts:76-122, 170-224`).
- Count drift is structural: README/index counts are hand-typed and re-drift after every catalog change; `checkSubstrate()` already demonstrates the generate-and-diff fix pattern.
- CLI help omits live commands `wiki` and `verdict-gate` (`printHelp()` `index.ts:32-106` vs dispatch `index.ts:213-430`).
- No central way for an agent to ask "which equipped external tools provide capability X, and are they currently available?" — tool guidance is scattered across skills.

## Requirements

- Functional: inventory covers the whole harness surface (add: hook-handlers, scripts, modes, schemas, workflow spec, templates, external tool capabilities); entries gain `capability`, `producer`, `consumer`, `activation` (user-invoked / auto / on-demand), `enforcement` (hard/advisory/prose-only), `probe`, `status`, `checked_at`; counts and index docs are generated from inventory; capability query subcommand for equipped tools with availability probing.
- Non-functional: probes cheap and side-effect-free; on-demand artifacts never misreported as always-on context (feeds the context-audit fix in this phase); generated docs deterministic.

## Related Code Files

- Modify: `packages/mewkit/src/core/build-inventory.ts`, `packages/mewkit/src/commands/inventory.ts`, `packages/mewkit/src/core/substrate.ts`, `packages/mewkit/src/core/check-stale-index.ts` (flip from "compare hand-typed counts" to "rewrite generated count blocks + verify"), `packages/mewkit/src/index.ts` (`printHelp()` gains `wiki`, `verdict-gate`; new `inventory --capability` query), `.claude/harness-inventory.json`, `.claude/agents/SKILLS_INDEX.md` + `AGENTS_INDEX.md` + README count blocks (become generated regions), `.claude/skills/context-audit/` (tier metrics: always-on vs conditional vs on-demand, using inventory `activation` field).
- Create: `packages/mewkit/src/core/__tests__/` coverage for new types/fields; external-tool capability entries (probe command per tool, e.g. `command -v`, version check).
- Delete: hand-maintained count claims (replaced by generated markers).

## Implementation Steps

1. **Tests first:** enumeration finds `.cjs` handlers via `handlers.json`; new artifact types appear with correct paths; capability query returns tools by capability with probe status; generated count blocks round-trip; stale substrate detected.
2. Extend `ArtifactType` + `enumerateArtifacts()`; source `producer`/`consumer`/`enforcement` for hooks from the Phase 2 hook manifest instead of hand-typing.
3. Add the new fields to `InventoryEntry` + registry schema; backfill critical artifacts first (hooks, gates, state files, commands); non-critical skills/agents keep tag-on-touch with a **concrete deadline mechanism** (red team): a version constant in the substrate check — `validate --substrate` returns failure instead of warning once the kit version reaches the declared value, so the deadline is enforced by code, not by intention.
4. Implement `inventory --capability <name>` (and `--probe` to refresh `status`/`checked_at`) for external tools. **Probe safety (red team, critical):** probe commands come from a vetted, hardcoded table in source (the `doctor-checks.ts:284-290` pattern) keyed by capability id — never from shell strings stored in `harness-inventory.json`, whose writes bypass Gate 1 (`gate-enforcement.sh:93`) and would otherwise be a command-injection channel. Migrating skills to reference capabilities instead of hardcoded tool names is scoped to **only the skills this plan already touches**; the catalog-wide sweep is explicitly deferred.
5. Generate count/index docs: marked regions in README/SKILLS_INDEX/AGENTS_INDEX written by `inventory --emit`; `--check` verifies; CI enforces.
6. Re-emit `harness-substrate.md`; clear the current 5 count-drift + stale-substrate failures; keep both green in CI.
7. Fix `/mk:context-audit` overhead math using `activation`: only always-on artifacts count as static overhead; report conditional and on-demand separately.

## Success Criteria

- [ ] `mewkit inventory --check` and `mewkit validate --substrate` pass in CI at phase end.
- [ ] Every critical artifact (hooks, handlers, gates, state files, commands, workflow spec) has owner, activation, enforcement, and consumer populated.
- [ ] An agent can answer "which tools provide capability X and are they available?" with one CLI call.
- [ ] README/index counts regenerate from inventory; hand-editing them fails CI.
- [ ] Context-audit no longer reports on-demand catalog as static load.
- [ ] `wiki` and `verdict-gate` appear in CLI help.

## Risk Assessment

- **Metadata backfill stalls (160 untagged):** critical-artifacts-first ordering plus a dated deadline converts the warning to failure on schedule instead of blocking this phase.
- **Probe flakiness marks tools unavailable:** probes record `checked_at` and degrade to `unknown`, never hard-fail validation on probe errors.
- **Inventory schema growth bloats context:** inventory is on-demand (CLI query), never injected wholesale; only pointers surface in session context.
