# Phase 7 — Set changes, doctor overlap check, close-out

**Priority:** medium · **Status:** done; published docs and changelog updated, `mk:document-release` waits for the PR · **Effort:** 3d · **Depends on:** 6

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

- [x] Whole-set planning and move summary
- [x] Add-then-remove lifecycle tests
- [x] Doctor overlap check
- [x] Docs and close-out

## Success criteria

- The lifecycle equality test passes for every overlapping pair and for the full set.
- `mewkit doctor` exits non-zero on the seeded duplicate and zero on a clean six-runtime install.
- `git ls-files tasks .meowkit` shows only packaging files.

## Done (2026-11-19)

- **Set changes.** `init`, `uninstall` and `upgrade` plan again every installed runtime whose files depend on the one changing (`commands/mod.rs` `depends_on`: Codex, Pi and OMP on each other; OMP on Claude Code). Each prints a note naming the runtime and why before the outcomes. `pack` needs nothing: it serves Claude Code only, and Claude Code's files do not depend on the set.
- **Hooks do not move.** The requirement's example (hooks moving to `.cursor/hooks.json` when Claude Code leaves) does not arise: since Phase 5 every runtime keeps its own hook file in every set.
- **Lifecycle tests** (`crates/mewkit-cli/tests/lifecycle_set_changes.rs`): for all 30 ordered pairs, `init A` → `init B` → `uninstall A` equals a fresh `init B`, and removing B leaves nothing; six added one at a time equal six at once; the full set taken down one runtime at a time equals a fresh install of what remains at each step. `.claude/runtime.json` is left out of the comparison because it records the launcher's absolute path. The file takes 5 to 15 minutes.
- **Doctor** (`doctor/overlap.rs`, `doctor/overlap_survey.rs`), from the surface table, the ownership indexes and the disk, project scope only:
  - `coexistence: cross-runtime load` (ok or warn) lists per installed runtime the kit skills, agents and hook sets it loads from a second root, with the vendor's setting that stops it; roots the vendor leaves unsettled and non-kit names under two roots are information. A root switched off by a project file (`.omp/config.yml`) is not counted. It replaces the Cursor-only row.
  - `kit copies: unrecorded` fails the run when an `mk-` skill or agent no install recorded sits under a second root an installed runtime reads.
  - A root that is itself a symlink is skipped (its entries are another root's), only `.md` and `.toml` files count as agents, and both rows say when a listing was cut at 200 entries. An independent review found these three; its claim that Cursor gets no `.cursor/skills` beside Claude Code did not hold (the emitter writes it in every set, and `validate --target cursor` passes on a six-runtime install).
  - A clean six-runtime install exits 0 with the first row at warn: Cursor and Grok read other runtimes' trees and no placement removes that (`docs/maintainer/runtime-surface-table.md`, "Double loads no placement removes"). Always-on text and MCP entries are not compared.
- **`validate --target cursor`** checked a ledger only the npm installer wrote and called every current install "Not a cursor target". It now checks the hook file, the hook runtime config, the `.mdc` rules and the skills; the npm recording of the old profile is deleted and listed in `tests/golden/DIVERGENCES.md`.
- **Docs:** `docs/core/enforcement-matrix.md` (second table for Grok, Pi, OMP, marked not run live), `packages/docs/content/docs/installation.mdx`, `cli/portability.mdx`, `CHANGELOG.md` (Unreleased), `docs/core/branding-style-guide.md`.

## Open after this phase

- Nothing in Grok or Pi has run in a live session; OMP only listed skills. Checklist C3, C5, C8, C9 and smoke rows 10–16.
- The Cursor emitter writes `.cursor/skills` in every set, so Cursor beside Claude Code or Codex loads the kit's skills twice; the resolver would write one root. Doctor reports it.
- The shared `.agents/` wording needs a human read.
- Doctor's overlap rows read the project only; a user-scope Cursor beside a user-scope Claude Code or Codex install is no longer reported (the row they replace did).
- An ownership index that cannot be read counts as no install, so its entries can show as unrecorded copies; `installs` reports the broken index on its own row.

## Next steps

- User-global installs for Grok, Pi and OMP.
- The live routing and with/without evals still waiting for approval from the previous plan.
