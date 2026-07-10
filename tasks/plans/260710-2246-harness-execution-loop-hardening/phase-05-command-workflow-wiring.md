---
phase: 5
title: "Command & Workflow Wiring"
status: pending
effort: "M"
priority: P2
dependencies: [1, 4]
---

# Phase 5: Command & Workflow Wiring

## Overview

Give command intent and workflow phase transitions a machine-readable authority so behavior no longer lives only in prose. Resolve the duplicate-name/different-semantics drift between CLI subcommands and slash commands, make slash commands thin wrappers over declared intents, and connect workflow phases to the Phase 1 state producers.

**No new registry (red team):** the inventory already enumerates commands as an artifact type (`build-inventory.ts:14`) and Phase 4 gives entries `capability`/`producer`/`consumer`/`activation`/`enforcement` fields. This phase **extends those same command entries** with `intent`, `executor`, `produces`, and `conflicts_with` — one generated authority, not a parallel `command-registry.json` covering the same 46 surfaces. Hence the dependency on Phase 4.

## Key Insights (verified)

- Name collisions with different semantics exist today: `mewkit validate` runs harness structure/wiring checks (`commands/validate.ts`) while the `/validate` slash command runs a Python anti-pattern/security scan of the *target codebase* (`.claude/commands/mk/validate.md:15-17` → `.claude/scripts/validate.py` + `security-scan.py`). `mewkit upgrade` and the `/upgrade` slash doc drift on flags (`--list`, `--no-cleanup`, `--yes` wired at `index.ts:225-233` but undocumented in `upgrade.md`).
- 25 slash commands exist under `.claude/commands/mk/`; each points at skills via prose; there is no declared mapping command → intent → skill/CLI → produced artifact.
- `workflow.yaml` is a spec/drift-check document; no runtime component reads it to drive transitions. Phase leads and required outputs are declared (`workflow.yaml:14-64`) but transitions have no producer — Phase 1 introduces the producer (`state set-phase`); this phase binds it to the workflow spec.
- `task.ts` only does `tasks/` file CRUD; it is not a state orchestrator and should stay that way (authority split: files vs session state).

## Requirements

- Functional: inventory command entries declare, per user-facing command: intent, executor (CLI subcommand / skill / script), inputs, produced artifacts, and state transitions triggered; slash command files carry `executes:`/`produces:` frontmatter verified against the inventory; every workflow phase transition has a machine-readable producer call; colliding names reconciled.
- Non-functional: inventory consumed on demand (not always-on context); no behavioral change to commands other than declared reconciliations; wrappers stay short — front-door prose moves to skills.

## Related Code Files

- Create: intent-field schema + drift check `validate --commands` (reads inventory, compares against `index.ts` dispatch and slash frontmatter); E2E fixture test proving command → skill/CLI → artifact + state transition for one representative flow (plan command → plan dir + active-run state).
- Modify: `packages/mewkit/src/core/build-inventory.ts` (command-entry fields — coordinated with Phase 4), `.claude/commands/mk/*.md` (frontmatter; `/upgrade` doc gains missing flags), `.claude/workflow.yaml` (each phase's `transition` references the Phase 1 state producer call), `.claude/skills/workflow-orchestrator/**` and `.claude/skills/plan-creator/**` (invoke `state` CLI at transitions — coordinated with Phase 1 step 6), `packages/mewkit/src/commands/validate.ts` (add `--commands`).
- Delete: none.

## Implementation Steps

1. **Tests first:** intent-field schema validation; drift check fails when a slash command's declared executor/artifacts disagree with inventory or when a CLI/slash name pair diverges semantically without a declared distinction; E2E fixture asserts artifact + state effects.
2. Define the intent fields on command inventory entries: `surface` (cli/slash/both), `intent`, `executor`, `produces` (artifacts + state transitions), `conflicts_with` (explicit, documented distinctions).
3. Populate for all 21 CLI dispatch cases and 25 slash commands.
4. Reconcile collisions: rename the `/validate` slash command to a scan-specific name (inventory records the old name as deprecated alias with a pointer), or — if rename is rejected — declare the distinction explicitly in both help surfaces so each names the other. Sync `/upgrade` docs with wired flags.
5. Wire workflow transitions: each `workflow.yaml` phase lists its transition producer (`state set-phase N`); the drift validator verifies the referenced skills actually contain that instruction. (This grep check is drift detection only — runtime proof is the E2E fixture here and the Phase 7 drills.)
6. Add `validate --commands` to CI.

## Success Criteria

- [ ] Inventory covers every CLI and slash command with intent fields; `validate --commands` passes in CI; no standalone command registry file exists.
- [ ] No command name maps to two different behaviors without a declared, help-visible distinction.
- [ ] Every workflow phase has a machine-readable transition producer, and the declaring skill demonstrably contains the producer call.
- [ ] E2E fixture proves one full chain: command → skill/CLI execution → expected artifacts + state transition.
- [ ] `/upgrade` documentation matches wired flags.

## Risk Assessment

- **Intent metadata drifts from dispatch reality:** drift checks are bidirectional (inventory ↔ dispatch switch, inventory ↔ slash frontmatter) and CI-enforced; the inventory is authoritative, surfaces are verified projections.
- **Renaming `/validate` breaks user habit:** deprecated-alias entry keeps the old name working with a deprecation notice for one release cycle.
- **Prose-executed transition calls still skippable by the model:** accepted residual risk (see plan.md threat model); gate/pre-completion consumption (Phase 2) is the backstop that makes skipping visible.
