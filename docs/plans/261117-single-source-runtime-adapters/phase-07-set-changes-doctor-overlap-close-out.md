# Phase 7 — Set changes, doctor overlap check, close-out

**Priority:** medium · **Status:** not started · **Effort:** 3d · **Depends on:** 6

## Overview

Adding or removing one runtime can move content that belongs to another (the hook home, the shared skill root). Make `init`, `uninstall` and `pack` recompute placement for the whole installed set, give `doctor` a check that reads the installed tree, and finish the docs.

## Requirements

- `init --target X` on a project that already has Y plans for the set {X, Y}: the summary lists what moves and why before anything is written; a move of a user-modified file follows the existing ownership rules.
- `uninstall --target X` re-plans the remaining set (for example, hooks move from `.claude/settings.json` to `.cursor/hooks.json` when Claude Code leaves).
- `doctor`: for each installed runtime, list every kit item that runtime would load from more than one path, using the surface table against the files on disk. Non-kit duplicates are reported as information.
- Prompts stay line prompts; non-TTY runs need the flag, as today.

## Related files

- Modify: `crates/mewkit-cli/src/commands/init/`, `uninstall`, `pack`, doctor rows in `mewkit-core`
- Create: lifecycle cases for add-then-remove across overlapping pairs
- Modify: `docs/core/enforcement-matrix.md`, `docs/maintainer/npm-cli-retirement.md` if it names bundles, published docs under `packages/docs/content` that describe the bundles or the supported runtimes, `CHANGELOG.md`
- Run: `mk:document-release` after the last PR

## Steps

1. Whole-set planning in `init` and `uninstall`; move summary.
2. Lifecycle test: `init A` → `init B` → `uninstall A` equals fresh `init B`, for the overlapping pairs and for all six.
3. Doctor overlap check with a seeded duplicate in a test.
4. Docs, changelog, memory entry for the decision; confirm `tasks/` and `.meowkit/` hold no work artefacts.

## Todo

- [ ] Whole-set planning and move summary
- [ ] Add-then-remove lifecycle tests
- [ ] Doctor overlap check
- [ ] Docs and close-out

## Success criteria

- The lifecycle equality test passes for every overlapping pair and for the full set.
- `mewkit doctor` exits non-zero on the seeded duplicate and zero on a clean six-runtime install.
- `git ls-files tasks .meowkit` shows only packaging files.

## Next steps

- User-global installs for Grok, Pi and OMP.
- The live routing and with/without evals still waiting for approval from the previous plan.
