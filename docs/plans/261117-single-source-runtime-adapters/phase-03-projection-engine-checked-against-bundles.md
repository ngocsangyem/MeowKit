# Phase 3 — Projection engine, checked against the bundles

**Priority:** high · **Status:** done 2026-11-20, except three open divergence rows (helper paths on Cursor, helpers the bundles did not ship, skill names in script messages) · **Effort:** 5d · **Depends on:** — (parallel with 1–2)

## Overview

Turn the authored `.claude/` tree into another runtime's files by rule. The hand-ported bundles are the oracle: project, diff against `kit/bundles/<runtime>/root`, and settle every difference before the bundles go.

## Key insights

- Bundle bodies differ from source by about ten lines a skill, mostly mechanical: `name: mk:x` → `mk-x`, `.claude/` path classes, skill references, tool wording, frontmatter fields.
- CI already keeps the source projectable; `kit-capabilities.json` already states the rewrite contract.
- Some bundle content has no source (research §2, last paragraph): it becomes an overlay, not a rule.

## Architecture

- **Reader:** kit tree → typed items (skill with files, agent, rule, hook handler, MCP profile).
- **Transforms**, each a pure function with its own tests: frontmatter by runtime schema; skill name form; skill reference form by dialect; path class rewrite (rules, agents, hooks, other skills, kit data files); tool wording from `kit-capabilities.json` (an `unsupported` tool is reported, not dropped); agent format (Markdown frontmatter or Codex TOML with a real `description`); model pin from the tier table in `docs/maintainer/model-pins.md`.
- **Overlays:** `kit/overlays/<runtime>/` holds files and per-file fragments that replace or append; an overlay naming a source file that no longer exists fails validation.
- **Dialects:** `host(<runtime>)` and `shared`.

## Related files

- Create: `crates/mewkit-adapters/src/projection/` (`reader.rs`, `transform_*.rs`, `overlay.rs`, `dialect.rs`), `kit/overlays/`, `docs/maintainer/projection-divergences.md`
- Create: `crates/mewkit-adapters/tests/projection_matches_bundles.rs` (temporary; deleted in Phase 4; stands in for the planned compare script)
- Modify: `.claude/kit-capabilities.json` (schema note for more runtimes). `scripts/kit-ship-set.cjs` ships `kit/overlays` from Phase 4, when an emitter reads it

## Steps

1. Reader and the name, path and reference transforms; project Codex skills; diff.
2. Classify every residual difference: new rule · overlay fragment · bundle wording to adopt in source · drop with reason. Start from the keys in `scripts/bundle-parity-allow.json`.
3. Agents (Codex TOML, Cursor Markdown); decide per the allow-list whether the rewritten Cursor agents become overlays or the source adopts their form.
4. Repeat for Cursor skills, rules (`.mdc` overlays), rubrics relocation.
5. Run `check-instruction-criteria.cjs` on both projected trees.

## Todo

- [x] Reader and transforms with unit tests: skill reader; name, reference, path, host-word, anchoring and heading-link rules; frontmatter; agents as TOML and Markdown; model pins; overlays; whole-tree projection
- [ ] Tool wording as a transform: dropped. The source now says it in neutral words; criterion A9 on the projected tree reports any tool name left
- [x] Skill files that are not Markdown: path rules only (`projection/script.rs`), compared with both bundles and syntax-checked
- [x] Codex skills and agents at zero unexplained differences (every class is listed in the divergence list)
- [ ] Cursor skills, agents, rules at zero unexplained differences (skills and agents listed; row 15, `.mdc` rules and rubrics wait for Phase 5)
- [x] Divergence list reviewed by the maintainer (rows 1–8 decided 2026-11-17, rows 9–15 on 2026-11-18)

## Success criteria

- `cargo test -p mewkit-adapters --test projection_matches_bundles` passes with every remaining difference listed in `projection-divergences.md`.
- Criteria A9, A10, A13 pass on projected output.

## Risks

- Wording tuned in PR #54 is lost → any body difference that is not mechanical is shown to the maintainer, who picks source change or overlay.
- Overlays grow into a second bundle → count overlay files in CI and print the figure.
