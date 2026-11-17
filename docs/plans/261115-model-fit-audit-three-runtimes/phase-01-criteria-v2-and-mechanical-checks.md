---
phase: 1
title: "Criteria v2 and mechanical checks"
status: done
priority: P1
effort: "3d"
dependencies: []
---

# Phase 1: Criteria v2 and mechanical checks

## Context Links

- [Baseline and vendor sources](research/baseline-and-vendor-sources.md) — §1, §2 and §3 are the inputs of this phase
- `docs/maintainer/instruction-audit-criteria.md` (A1–A8 today), `scripts/check-instruction-criteria.cjs`, `scripts/lib/instruction-criteria-rules.cjs`
- `crates/mewkit-core/src/validate/denied_tokens.rs`, `generic_tokens.rs` (existing token sets)
- `docs/research/meowkit-evolution-2611/05-skill-agent-rule-hook-audit.md` §2 (MECHANICAL / STRUCTURAL / JUDGEMENT grading)

## Overview

- **Priority:** P1
- **Status:** Done (24cf9b32)
- **Effort:** 3d
- **Depends on:** —
- **Description:** Write down what "fits a current model" means for each artefact type and runtime, turn every part of it that a script can judge into a checker criterion, wire the checker into CI, and record the before table. One pull request; no instruction text changes except fixture files.

## Key Insights

- The checker exists but CI does not run it (`grep check-instruction-criteria .github/workflows/ci.yml` is empty); a criterion that is not in CI drifts back.
- Rust already holds a Claude-bound token list (`denied_tokens.rs:15-26`) but runs it on installed output only and lacks `subagent_type` and `TodoWrite` (from: research/baseline-and-vendor-sources.md N12). One list must feed both checkers, or they disagree.
- The Claude Code listing is `description` + `when_to_use`; comparing `description` alone made Claude Code look 40% smaller than it is (§1).
- Cursor always-on is understated: `runtime-invariants.mdc` is `alwaysApply: true` and not counted (§1).
- Vendor guidance converges: reasons over absolutes, no standing delegate or re-verify lines, front-loaded trigger descriptions, references one level deep with contents lists (§3).

## Requirements

### Functional
1. `docs/maintainer/instruction-audit-criteria.md` gains, per artefact type (rule, AGENTS.md, agent, skill description, skill body, hook message) and per runtime, the meaning of "fits", each line citing a vendor source from the research file.
2. New mechanical criteria, each a `checkFile` rule with a test fixture:
   - **A9** host-foreign tool syntax in a bundle tree: the Rust denied-token set plus `subagent_type`, `TodoWrite`, `ExitPlanMode`, `Skill tool`; Cursor may keep "Task tool" (its documented delegation tool).
   - **A10** skill references use the host's name form: `mk-x` in bundles, `mk:x` on Claude Code.
   - **A11** description fitness: third person, no first/second person opener, ≤1,024 chars; Claude Code `description`+`when_to_use` ≤1,536 chars; per-tree listing total reported.
   - **A12** progressive disclosure: SKILL.md ≤500 lines; a reference over 100 lines starts with a contents list; a reference does not send the reader to a second reference for required steps (one level deep).
   - **A13** agent `model` values appear in `docs/maintainer/model-pins.md` (id, runtime, source URL, date checked).
   - **A14** no standing re-verify phrasing (`double-check`, `re-verify`, `verify again`) and no unconditional delegate instruction without a stated condition; reported per file, failing only on new occurrences above the baseline file.
3. A8 counts Cursor `alwaysApply: true` rules; A3 reports emphatic tokens per file, and per tree outside `security-rules.md`/`injection-rules.md`.
4. `--metrics` prints every metric in the Before/After table below; `--baseline <file>` lets A12/A14 fail only on growth.
5. CI runs `node scripts/check-instruction-criteria.cjs` on all three trees.

### Non-Functional
- Checker stays dependency-free Node; each source file stays under 200 lines (split rules into `scripts/lib/instruction-criteria-*.cjs`).
- The pinned-text hash check is unchanged.

## Architecture

```
denied-token list (one JSON in scripts/lib/, read by the JS checker; Rust keeps its own copy,
  with a test that the two lists are equal)
check-instruction-criteria.cjs → rules A1–A14 per tree → findings | --metrics table
  → baseline JSON for growth-only criteria (A12 contents, A14) → CI step
```

## Related Code Files

### Files to Create
- `scripts/lib/instruction-criteria-skill-rules.cjs` (A11, A12), `scripts/lib/instruction-criteria-host-rules.cjs` (A9, A10, A13, A14)
- `scripts/lib/host-foreign-tokens.json`, `scripts/instruction-criteria-baseline.json`
- `docs/maintainer/model-pins.md`
- `tests/instruction-criteria.test.ts` with fixtures under `tests/fixtures/instruction-criteria/`

### Files to Modify
- `scripts/check-instruction-criteria.cjs`, `scripts/lib/instruction-criteria-rules.cjs` — wire new rules, Cursor always-on count, metrics
- `docs/maintainer/instruction-audit-criteria.md` — criteria A9–A14, per-runtime fit table, before table
- `.github/workflows/ci.yml` — add the checker step
- `crates/mewkit-core/src/validate/denied_tokens.rs` — add the two missing tokens; test for list equality

### Files to Read (Context)
- `scripts/check-skills-portable.cjs` — avoid duplicating its own-path and tool-name checks

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Modify | `scripts/check-instruction-criteria.cjs` | New criteria, metrics, baseline flag | new vitest file |
| Create | `scripts/lib/instruction-criteria-{skill,host}-rules.cjs` | Keep files under 200 lines | fixtures |
| Create | `scripts/lib/host-foreign-tokens.json` | One token list | equality test vs Rust |
| Modify | `crates/mewkit-core/src/validate/denied_tokens.rs` | Two tokens | `cargo test` |
| Modify | `.github/workflows/ci.yml` | Run checker | CI |
| Create | `docs/maintainer/model-pins.md` | Pin source of truth | read by A13 |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Checker findings per criterion | none (script has no test) | fixture per criterion, pass and fail | High |
| Rust and JS token lists agree | none | equality test | Medium |

### Interface Checklist

- `check-instruction-criteria.cjs` CLI keeps its arguments and exit codes (0 pass, 1 finding, 2 crash); `--metrics` keeps its first five columns.
- `mewkit validate --target codex` output shape unchanged.

### Dependency Map

- Phases 2–6 read the criteria and the baseline file written here; Phase 3 reads `model-pins.md`.

## Implementation Steps

1. Write the per-runtime "fits" table and A9–A14 into the criteria doc, each line with its source.
2. Extract the token list to JSON; add `subagent_type`, `TodoWrite` in Rust and JS; add the equality test.
3. Implement A9–A14 and the Cursor always-on count in two new lib files; add fixtures and `tests/instruction-criteria.test.ts`.
4. Fill `model-pins.md` from the Codex, Cursor and Claude model pages (date each row); leave current pins listed as `retired` or `not listed` where they are.
5. Run `--metrics`; write the before table; write the baseline JSON for growth-only criteria.
6. Add the CI step; run it with the expected current findings recorded in the baseline so CI is green.

## Todo List

- [x] Criteria doc: per-runtime fit table, A9–A14, sources
- [x] One host-foreign token list shared by JS and Rust, with equality test
- [x] A9–A14 and Cursor always-on count implemented with fixtures
- [x] `model-pins.md` filled and dated
- [x] Before table and baseline JSON recorded
- [x] CI step added and green

## Success Criteria

1. `npx vitest run tests/instruction-criteria.test.ts` exits 0; each criterion has one failing and one passing fixture.
2. `node scripts/check-instruction-criteria.cjs --baseline scripts/instruction-criteria-baseline.json` exits 0 on `main` plus this PR.
3. `node scripts/check-instruction-criteria.cjs --metrics` prints the table in the criteria doc, Cursor always-on 6,356 B.
4. `cargo test -p mewkit-core denied_tokens` exits 0.
5. `grep -n check-instruction-criteria .github/workflows/ci.yml` finds the step.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| A14 regexes flag legitimate text ("verify" in a test skill) | H | L | Narrow phrases only; growth-only against baseline; per-line allow comment for real cases |
| A11 first-person test misfires on quoted examples | M | L | Check only the frontmatter value |
| Two token lists drift | M | M | Equality test |

## Security Considerations

- The pinned-text hash for `security-rules.md` and `injection-rules.md` stays; A3 never asks to soften those files.

## Outcome (2026-11-15)

- All six todos done; success criteria 1–5 verified (35 vitest cases, baseline run exit 0, Cursor always-on 6,356 B, `cargo test -p mewkit-core denied_tokens` 2 pass, CI step present). Full `npm test` 461/461, `cargo test --workspace --locked`, clippy, `mewkit validate` all exit 0.
- Deviation: `mk-planning-engine/SKILL.md` in both bundles reworded two `Agent(subagent_type: …)` lines, because the new Rust token would otherwise fail installed-Codex validation.
- Added beyond the phase text after review: the baseline also fails when it is loose (fixes must lower counts); `--write-baseline` with trees rewrites only those trees; `criteria-allow` line waiver.
- Reviewer suggested scoping `subagent_type` to Codex only; kept on both bundles per plan AC "No bundle file contains `subagent_type`".
- Found, not fixed: `kit/bundles/codex/root/.codex/hooks/pre-ship.cjs` is committed `100644`, so `mewkit validate --target codex` on an install fails "hook wrappers executable" (pre-existing from PR #53).

## Next Steps

- Phases 2–6 use these criteria; Phase 7 records the after table with the same command.
