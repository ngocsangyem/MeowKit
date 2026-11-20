---
title: "One authored kit, projected to each runtime by adapters that place files by the set of runtimes installed"
type: refactor
status: done
priority: high
effort: xl
created: 261117
blockedBy: []
blocks: []
---

# One authored kit, projected to each runtime by adapters that place files by the set of runtimes installed

## Goal

`mewkit init --target <any subset of claude-code, codex, cursor, grok, pi, omp>` installs from the one authored tree (`.claude/` plus small per-runtime overlays), each file in the form that runtime documents, and no skill, rule, hook or MCP server is loaded twice by any runtime in the project.

## Context

- Runtimes read each other's folders: Cursor, Grok and OMP load `.claude/` content; Codex, Cursor, Pi and OMP all read `.agents/skills` (from: research/runtime-discovery-matrix.md §1). An adapter that looks only at its own runtime therefore duplicates.
- The repo already treats `.claude/` as the projectable source: `scripts/check-skills-portable.cjs`, `rewrite-own-skill-paths.cjs --check` and `.claude/kit-capabilities.json` ("an emitter for another runtime rewrites the mention") run in CI, but no emitter uses them; Codex and Cursor ship hand-ported bundles (`kit/bundles/`, 2 × ~1,070 files).
- PR #54 added `check-bundle-parity.cjs` with 70 allowed outline-drift keys still unported: the cost of keeping three hand-written trees in step.
- v3 is unreleased, so `kit/bundles/` can be removed without a migration path (maintainer, 2026-11-17).
- ak's projection is the reference design; its measured gaps are listed in research §3 and are requirements here.

## Scope

- **In:** `crates/mewkit-adapters` (placement resolver, projection, six emitters), `mewkit-core` validate targets and doctor rows, `kit/overlays/`, removal of `kit/bundles/` and its parity tooling, hook payload normalisation in `hooks/lib/core`, maintainer docs.
- **Out:** a new neutral authoring format (`kit.yaml`), renaming Claude Code skill `name:` values, an `onboard` command, the Claude Code plugin delivery, user-global installs for the three new runtimes, live model runs unless approved.

## Phases

| # | Phase | Status | Effort | Depends On |
|---|-------|--------|--------|------------|
| 1 | [Probe what the docs leave open](phase-01-probe-open-runtime-behaviour.md) | Done by inspection; checklist C1–C7 open | 1d | — |
| 2 | [Runtime surface table and placement resolver](phase-02-runtime-surface-table-and-placement-resolver.md) | Done: table with sources, resolver, 63-set test, rendered page; emitters receive the placement and do not read it yet (Phase 4). Three double loads no placement removes are listed in `docs/maintainer/runtime-surface-table.md` | 3d | 1 |
| 3 | [Projection engine, checked against the bundles](phase-03-projection-engine-checked-against-bundles.md) | Done: the engine projects skills, scripts, frontmatter, agents and overlays, and all five projected runtimes install from it; instruction criteria clean on every installed tree (2026-11-20); divergence rows 1–14 decided. Three rows stay open in `docs/maintainer/projection-divergences.md`: Cursor helper paths (row 15), helpers the bundles did not ship, skill names in script messages | 5d | — |
| 4 | [Codex and Cursor emitters on projection; bundles removed](phase-04-codex-cursor-on-projection-bundles-removed.md) | Done: both emitters install from projection plus overlays; `kit/bundles/` and the parity tooling are deleted; the checks read an installed tree; kit contract 2. The decision note is not written | 4d | 2, 3 |
| 5 | [Hooks and always-on text placed once](phase-05-hooks-and-always-on-text-placed-once.md) | Done for Claude Code, Codex and Cursor; the other three with their emitters | 4d | 2, 4 |
| 6 | [Grok, Pi and OMP emitters](phase-06-grok-pi-omp-emitters.md) | Done at project scope: six emitters; Codex, Pi and OMP share `.agents/` (neutral folder `.agents/meowkit/`, maintainer 2026-11-19). No Grok agent definitions (format undocumented); Pi and Grok not probed | 6d | 4, 5 |
| 7 | [Set changes, doctor overlap check, close-out](phase-07-set-changes-doctor-overlap-close-out.md) | Done: 30 pairs and the full set equal a fresh install; doctor lists double loads and fails on an unrecorded kit copy; published docs and changelog updated | 3d | 6 |

## Decisions (confirmed by the maintainer 2026-11-17, as recommended)

| # | Decision | Chosen |
|---|---|---|
| D1 | Authoring source | Keep `.claude/` as the source; add `kit/overlays/<runtime>/` only for files that cannot be derived (Cursor `.mdc` frontmatter, Codex `default.rules`, per-runtime hook entry scripts, always-on AGENTS text) |
| D2 | Skill text when several runtimes share `.agents/skills` | One shared dialect (capability wording, `mk-x` names, no host-only invocation sigil); a host dialect only when that runtime is the root's sole reader |
| D3 | Runtime reading both `.claude/skills` and `.agents/skills` (Cursor, OMP, maybe Grok) | Switch the foreign import off in project config where the runtime documents a switch; otherwise write one root only, chosen by Phase 1 results |
| D4 | Order of new runtimes | Grok, then Pi, then OMP (OMP has no trust gate and the widest import, so it goes last) |
| D6 | Hand wording in the bundles that no rule reproduces (tool-name rephrasings, added or dropped sections, descriptions; measured in research/source-vs-codex-bundle-measurement.md) | Fix it in `.claude/`: the source says it in runtime-neutral words, so projection stays mechanical (maintainer, 2026-11-17). Overlays only for text that belongs to one runtime |
| D5 | Probes | Inspection commands only (`grok inspect --json`, skill and hook listings); a probe that needs a model turn is run by the maintainer from a checklist |

## Acceptance Criteria

- [x] For each of the 63 non-empty runtime subsets, every runtime has one copy of its skills, guards and always-on text, written by its own emitter, and every second copy it loads is on a list. Met 2026-11-20: `emit_follows_placement.rs` runs every emitter for the 63 sets and holds the resolver to what they write (roots per kind, and shared wording where more than one runtime takes its copy from `.agents/skills`); `placement_resolver_tests.rs` pins the lists: eight certain double loads and three reads the vendors leave open, rendered with the setting that stops each in `docs/maintainer/runtime-surface-table.md`; `mewkit doctor` reports the ones present in a project. Reworded from "sees each skill name, hook decision, always-on rule block and MCP server exactly once": no placement gives that (Cursor documents no dedupe for skills, Grok and Cursor import Claude Code hooks), the maintainer chose on 2026-11-20 to keep `.cursor/skills` in every set while Cursor cannot be run, and no emitter installs an MCP server.
- [x] `test ! -e kit/bundles && test ! -e scripts/check-bundle-parity.cjs && test ! -e scripts/bundle-parity-allow.json`.
- [x] Projected Codex and Cursor trees differ from the last committed bundles only by entries in `docs/maintainer/projection-divergences.md`, each with a reason. Met 2026-11-20: the comparison was taken before the bundles were deleted, and the three rows it left open are closed (helper paths named by path in the source; every helper path the projected text names exists after a six-runtime install, 1,342 references and none missing; script messages kept as authored).
- [x] `node scripts/check-instruction-criteria.cjs` passes on the projected tree of every runtime (A9 host-foreign tokens, A10 name form, A13 pins). Checked 2026-11-20: no findings over `.claude` and the five installed trees.
- [x] `mewkit validate --target <runtime>` exists and passes for all six; `mewkit doctor` reports any path a second runtime also loads. Checked 2026-11-20 on a six-runtime install: exit 0 for codex, cursor, grok, pi and omp; Claude Code is plain `mewkit validate` (there is no `--target claude-code`).
- [x] Projected `AGENTS.md` ≤ 32,768 B; always-on bytes per runtime ≤ the figures at the start, except Cursor. Met 2026-11-20: `AGENTS.md` is 7,687 B, Claude Code is unchanged and Codex is lower. Cursor went from 6,316 B to 10,641 B when it took the shared block, which the maintainer accepted on 2026-11-19; the ceiling is held by instruction criterion A8.
- [x] `init` → `init` with one more target → `uninstall` of one target leaves a tree equal to a fresh `init` of the remaining set (lifecycle test).
- [x] `npm test`, `npx vitest run tests/guards`, `cargo test --workspace --locked`, `mewkit validate` exit 0. Checked 2026-11-20 on the final tree: 578 of 578, 53 of 53, 54 result lines with none failed, 34 passed.
- [x] Every row added to `docs/maintainer/host-probe-log.md` carries one of four statuses the log defines: `probed` (command, version, date), `documented, not probed` (URL), `read from source` (path and version) or `assumed` (what is assumed, its basis and the checklist item that settles it). Met 2026-11-20: X3, X8 and X9 are `assumed`, X7 and X13 `read from source`. Reworded from the two-status form: the maintainer cannot run the runtimes yet (2026-11-20), so the plan closes on stated assumptions, and no assumption about one runtime reading another's folder is relied on for its only copy.

## Open after this plan

Not part of the acceptance criteria; they need a live session in the runtime, which the maintainer runs:

- Checklist C1 to C9 in `docs/maintainer/runtime-probe-checklist.md`, and smoke rows 10 to 16 in `runtime-smoke-checklist.md`. Grok and Pi have never been run; OMP only listed skills.
- The three `assumed` rows of the probe log (X3, X8, X9). If C2 shows Cursor lists a kit skill once across folders, or the Third-Party Imports setting covers skills, the two Cursor skill double loads can be dropped from the table.

## Constraints

- Do NOT change `privacy-block` decisions, the blocked-pattern table or the numbered injection rules.
- One executor and one ownership index stay the only writers; an emitter returns a `Plan`, never writes.
- A fact about a runtime enters the surface table only with a doc URL, a source path with version, or a probe row.
- Do NOT regenerate frozen goldens silently; record each change in `crates/mewkit-cli/tests/golden/DIVERGENCES.md`.
- Code comments and file names cite no plan phase or decision code.
- Leave `tasks/` and `.meowkit/` without work artefacts.

## Risks

- Hand-tuned bundle wording from PR #54 is lost if projection cannot reproduce it → Phase 3 uses the bundles as the oracle before Phase 4 deletes them.
- A runtime changes its import rules → the surface table carries version and date; doctor's overlap check reads the installed tree, not the table.
