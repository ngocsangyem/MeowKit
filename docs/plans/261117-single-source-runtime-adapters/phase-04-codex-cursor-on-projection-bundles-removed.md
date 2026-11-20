# Phase 4 — Codex and Cursor emitters on projection; bundles removed

**Priority:** high · **Status:** done 2026-11-18, except the decision note (see below) · **Effort:** 4d · **Depends on:** 2, 3

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
- [x] Checks run on projected trees in CI
- [x] Bundles and parity tooling removed
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
- `mk-delegate` joined `core`, `mk-arch` `development`, `mk-breakdown` `product` and `mk-status` `operations` in both catalogs (maintainer, 2026-11-18). The catalogs' budget figures were stale and are recomputed from the projected descriptions.
- The bundles shipped `mk-benchmark` and three skills' `eval/` folders, which the kit's ship set excludes. With one source they no longer install on Codex and Cursor.

Second half, same day:

- `scripts/lib/installed-tree.cjs` copies the ship set to a temp kit and runs `mewkit init --target <runtime>` from it. `check-instruction-criteria.cjs` (trees `installed:codex`, `installed:cursor`), `check-skill-cross-refs.sh` and `skill-routing-keywords.test.ts` read that tree. They need the built binary (`$MEWKIT`, else `target/debug/mewkit`) and refuse one older than `crates/`.
- Reading the installed tree found what the bundle-based checks could not: two helpers the text runs and no install shipped (`injection-audit.cjs`, `secret-scrub.cjs`; now in `core-closure.json` and copied to both overlays), a Cursor line naming the Codex hook file (one overlay line), and two source lines naming Claude Code-only files (reworded).
- `kit/bundles/`, `check-bundle-parity.cjs`, `lib/bundle-parity-outline.cjs`, `bundle-parity-allow.json`, `tests/bundle-parity.test.ts` and the bundle comparison test are deleted. `tests/projects_whole_kit.rs` keeps the whole-kit projection check.
- Kit contract 2; the binary reads exactly 2.

Still open:

- `mewkit validate --target cursor` says "Not a cursor target" on a project this installer wrote: it detects an install by the npm CLI's ledger (`.meowkit/state/cursor-ledger.json`) and checks for a root `AGENTS.md`, neither of which a `mewkit init --target cursor` writes. The behaviour is pinned by the recorded npm comparison (`npm_behaviour/validate_target_cases.rs`), so changing it is a listed divergence to decide, not a fix made here. The success criterion "validate passes for Cursor" is not met.
- The decision note through `mewkit note decisions` is not written: `.meowkit/memory/decisions.md` does not exist yet, and creating it in the kit repository is the maintainer's call.
- Always-on ceilings are now measured on the installed form (7734 B Codex, 6316 B Cursor): the same text as 7676 B and 6289 B plus block markers and the rule header.
- The overlays hold byte copies of hook libraries, helpers and rubrics that `.claude/` also has (`sync-hook-core.cjs` keeps them equal), and `.codex/rubrics` beside the projected `mk-rubric/rubrics`. Deriving them belongs with the hook work in Phase 5.
- A Codex install prints about 136 `note:` lines (Claude Code tokens inside script code, paths created at run time). Not measured against the bundles.
- `research/measure-source-vs-codex-bundle.py` reads the deleted bundle and no longer runs; it is kept as the record of how the Phase 3 figures were made.
