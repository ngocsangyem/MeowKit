# Phase 4 — Codex and Cursor emitters on projection; bundles removed

**Priority:** high · **Status:** in progress · **Effort:** 4d · **Depends on:** 2, 3

## Overview

The Codex and Cursor emitters stop copying a bundle and build their `Plan` from projection plus placement. Then `kit/bundles/` and the tooling that kept it in step are deleted.

## Requirements

- Single-runtime installs produce the same tree as today, apart from listed divergences.
- Skill packs still select skills; `catalog/skill-packs.json` is derived from the source pack manifest instead of kept per bundle.
- `AGENTS.md` block merge, `.codex/hooks.json`, `.codex/config.toml` and `.cursor/hooks.json` merges keep their current behaviour.

## Related files

- Modify: `crates/mewkit-adapters/src/codex/mod.rs`, `codex/rewrite.rs`, `codex/shared.rs`, `cursor/mod.rs`, `cursor/frontmatter.rs`, `cursor/hooks.rs`, `claude_code/mod.rs` (reads placement)
- Delete: `kit/bundles/`, `crates/mewkit-adapters/src/bundle.rs`, `scripts/check-bundle-parity.cjs`, `scripts/lib/bundle-parity-outline.cjs`, `scripts/bundle-parity-allow.json`, `tests/bundle-parity.test.ts`, `scripts/compare-projection-to-bundle.cjs`; bundle targets in `scripts/sync-hook-core.cjs`; bundle entries in `scripts/kit-ship-set.cjs`
- Modify: `scripts/check-instruction-criteria.cjs` and `check-always-on-budget.cjs` (run on a projected tree built in a temp directory), `.github/workflows/ci.yml`, `crates/mewkit-cli/tests/golden/DIVERGENCES.md`, validate target profiles
- Modify: `.claude/kit-contract.json` (contract version bump)

## Steps

1. Switch the Codex emitter; lifecycle and golden tests; record golden changes with reasons.
2. Switch the Cursor emitter the same way.
3. Point the instruction, budget and denied-token checks at projected output.
4. Delete the bundles and parity tooling in one commit, after the checks are green on projection.
5. Update the comment in `codex/mod.rs` that says nothing is projected from `.claude/`, and `.meowkit/memory/decisions.md` through `mewkit note decisions` with the reason for the reversal.

## Todo

- [x] Codex emitter on projection
- [x] Cursor emitter on projection
- [ ] Checks run on projected trees in CI
- [ ] Bundles and parity tooling removed
- [ ] Decision recorded

## Success criteria

- `test ! -e kit/bundles`; `cargo test --workspace --locked` and `npm test` pass.
- `mewkit init --target codex` and `--target cursor` in a scratch project pass `mewkit validate --target <runtime>` and `mewkit doctor`.

## Risks

- The release zip shrinks by two trees and an older binary cannot read it → the kit contract version bump makes an old binary refuse with the upgrade message.

## Progress (2026-11-18)

Done:

- Both emitters build their plan from `projected_kit.rs`: `.claude/` projected for the runtime plus `kit/overlays/<runtime>/`. `bundle.rs` is gone.
- The 115 bundle files projection does not produce moved to the overlays unchanged: hook scripts and their libraries, `hooks.json`, `config.toml`, `default.rules`, the Cursor `.mdc` rules, `AGENTS.md`, rubrics, `scripts/bin`, the Codex `rule-advice-supervision` skill, and both catalogs (`catalog/skill-packs.json`, Cursor `catalog/mcp-profiles.json`).
- Codex at global scope: projection writes helper commands from the project root; the emitter turns those into absolute paths, as before.
- Baseline manifests and `DIVERGENCES.md` updated: 41 rows removed and 48 added per runtime.
- The kit ship set, hook closure, guard replays and scans read the overlays.

Not what the phase text assumed:

- The pack catalog cannot be derived from `.meowkit/pack-manifest.json`: Claude Code packs (`lifecycle-core`, `testing`, …) and the Codex and Cursor packs (`core`, `development`, …) are different groupings. Each overlay keeps its catalog.
- The bundles shipped `mk-benchmark` and three skills' `eval/` folders, which the kit's ship set excludes. With one source they no longer install on Codex and Cursor.

Left for the rest of this phase:

- `kit/bundles/<runtime>/root` still holds the hand-ported skills and agents. Nothing installs them; `projection_matches_bundles.rs`, `check-instruction-criteria.cjs`, `check-bundle-parity.cjs`, `check-skill-cross-refs.sh` and `skill-routing-keywords.test.ts` still read them. Those checks move to an installed tree, then the folder and the parity tooling go.
- The overlays hold byte copies of 10 hook libraries, 12 helpers and 10 rubrics that `.claude/` also has (`sync-hook-core.cjs` keeps them equal), and `.codex/rubrics` beside the projected `mk-rubric/rubrics`. Deriving them belongs with the hook work in Phase 5.
- `mk-arch`, `mk-breakdown`, `mk-delegate` and `mk-status` are in no Codex or Cursor pack.
- Kit contract version bump; the decision note through `mewkit note decisions`.
