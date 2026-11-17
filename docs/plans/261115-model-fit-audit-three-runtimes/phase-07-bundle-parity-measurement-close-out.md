---
phase: 7
title: "Bundle parity, after-measurement, close-out"
status: done
priority: P2
effort: "2d"
dependencies: [3, 4, 6]
---

# Phase 7: Bundle parity, after-measurement, close-out

## Context Links

- [Baseline and vendor sources](research/baseline-and-vendor-sources.md) — N4 (skill set differences)
- `docs/plans/261115-remove-gates-audit-runtimes-coexistence/research/researcher-01-bundle-provenance-and-sync.md` (bundles are hand-authored; only hook libs are script-synced)
- `scripts/sync-hook-core.cjs`, `docs/maintainer/instruction-audit-criteria.md`

## Overview

- **Priority:** P2
- **Status:** Done except the integration PR (needs the user's go-ahead)
- **Effort:** 2d
- **Depends on:** Phases 3, 4, 6
- **Description:** Add a CI check that keeps the three hand-kept trees in step after this sweep, record the after table, update docs and the changelog, and move the plan to `docs/plans/`. One pull request, then the single merge of the integration branch to `main`.

## Key Insights

- Bundles are hand-written ports; only 10 hook lib files are synced by script (from: prior plan researcher-01). Without a parity check, the next edit to `.claude/` drifts again.
- A full generator from `.claude/` to bundles is a larger change (host terms, file formats, TOML agents); a parity report is the smallest control that catches drift.
- Skill sets differ by design in five places (N4); the parity check needs an allow-list for them.

## Requirements

### Functional
1. `scripts/check-bundle-parity.cjs`: for each Claude Code skill, agent and rule section, the matching bundle file exists (or is in an allow-list with a reason), and its heading outline matches after host-term normalisation; prints per-file differences; exit 1 on an unlisted difference.
2. Allow-list file `scripts/bundle-parity-allow.json` holds the host-only skills and agents decided in Phase 6 and any section a host lacks.
3. CI runs the parity check.
4. After table recorded with the Phase 1 command; includes listing totals, emphatic tokens, A12/A14 counts, host-foreign token count, model pins current, hook channels model-visible.
5. Docs: criteria doc, `docs/core/enforcement-matrix.md` (if hook rows changed), changelog and upgrade note (new pins, retired observers if any, Codex read-only agents).
6. Plan directory moves to `docs/plans/261115-model-fit-audit-three-runtimes/`; `tasks/` and `.meowkit/` hold no work artefacts.

### Non-Functional
- Parity check dependency-free Node, under 200 lines per file, runs in under 5 s.

## Architecture

```
.claude/{skills,agents,rules} ─┐
codex bundle ──────────────────┼─▶ normalise host terms ─▶ compare outline ─▶ allow-list ─▶ report
cursor bundle ─────────────────┘
```

## Related Code Files

### Files to Create
- `scripts/check-bundle-parity.cjs`, `scripts/bundle-parity-allow.json`, `tests/bundle-parity.test.ts`

### Files to Modify
- `.github/workflows/ci.yml`, `docs/maintainer/instruction-audit-criteria.md`, `docs/project-changelog.md` (or the repo's changelog), `docs/core/enforcement-matrix.md` if needed

### Files to Read (Context)
- `kit/bundles/*/catalog/*.json` — existing bundle inventories to reuse

## Deep Phase Map

### File Inventory

| Action | Path | Reason | Test Impact |
|---|---|---|---|
| Create | `scripts/check-bundle-parity.cjs` | drift control | new test |
| Create | `scripts/bundle-parity-allow.json` | documented differences | read by check |
| Modify | `.github/workflows/ci.yml` | run check | CI |
| Modify | criteria doc, changelog | after table, notes | docs tests |
| Move | `tasks/plans/261115-model-fit-audit-three-runtimes/` → `docs/plans/` | close-out | `docs-changelog-immutability` |

### Test Gap Matrix

| Behavior | Existing Coverage | Missing Coverage | Priority |
|---|---|---|---|
| Bundles match `.claude/` | denied-token check, `sync-hook-core` for libs | outline parity for skills, agents, rules | High |

### Interface Checklist

- No change to installed file layout or adapter output.

### Dependency Map

- Runs after all edits; last PR before the integration merge.

## Implementation Steps

1. Write the parity check and its allow-list; add fixtures and test.
2. Run it on the integration branch; fix any real drift; list intended differences.
3. Add the CI step.
4. Record the after table; update criteria doc, enforcement matrix (if needed), changelog, upgrade note.
5. Move the plan to `docs/plans/`; verify `git status` and `git ls-files tasks .meowkit` show no work artefacts.
6. Open the integration PR to `main` (user approves the merge).

## Todo List

- [x] Parity check, allow-list, test
- [x] Drift fixed; differences listed
- [x] CI step added
- [x] After table and docs updated
- [x] Plan moved; `tasks/` and `.meowkit/` clean
- [ ] Integration PR opened

## Success Criteria

1. `node scripts/check-bundle-parity.cjs` and `npx vitest run tests/bundle-parity.test.ts` exit 0.
2. `docs/maintainer/instruction-audit-criteria.md` holds before and after tables for three runtimes with every Phase 1 metric.
3. `npm test`, `npx vitest run tests/guards`, `cargo test --workspace --locked`, `mewkit validate` exit 0 on the integration branch.
4. `test -d docs/plans/261115-model-fit-audit-three-runtimes && ! test -e tasks/plans/261115-model-fit-audit-three-runtimes` succeeds.

## Risk Assessment

| Risk | L | I | Mitigation |
|------|---|---|------------|
| Outline comparison too strict for host-specific sections | M | L | Allow-list per section; normaliser maps host terms |
| Parity check becomes a blocker on every small edit | M | M | Report shows the exact file pair to update; maintainers port in the same PR |

## Security Considerations

- N/A.

## Next Steps

- Follow-ups outside this plan: a generator for bundle ports; live routing and with/without evals (audit C-17, C-20) when approved.

## Progress (2026-11-17)

- Parity check: `scripts/check-bundle-parity.cjs` + `scripts/lib/bundle-parity-outline.cjs`, allow-list `scripts/bundle-parity-allow.json` (166 per-bundle differences under 7 reasons), `tests/bundle-parity.test.ts` (7 cases), CI step after the instruction criteria. Rubric files are matched at the bundles' host-level `rubrics/` folder.
- Decisions asked and answered: port the `workflow-*` helpers (not reword); Opus 5 and Fable 5 are COMPLEX/LEAN; Codex LEAN is explicit opt-in, as on Cursor.
- Real drift fixed:
  - helpers + closure (12 files) synced into `.codex/scripts/bin` and `.cursor/scripts/bin` by `sync-hook-core.cjs`, closure test added
  - rubric library ported to `.codex/rubrics` and `.cursor/rubrics`; bundle validators pass
  - `density-lookup.cjs` gains the 5.x rows; CC autobuild docs, harness rules and developer agent updated
  - Codex autobuild density ported from Cursor (opt-in LEAN)
  - `model-selection.md` and `examples.md` aligned with the tier pins in all three trees
  - mangled `${…:-the project environment…}` expansions fixed in `run-canary.sh` (both bundles) and Codex step-00 / density script
  - hard-coded "Opus 4.6" commit trailers removed
  - Codex developer agent loses leftover gate wording
  - `run-evaluator.sh` no longer prints `subagent_type`
- Found while verifying: the earlier `rg -l 'subagent_type|TodoWrite' kit/bundles` check skipped the hidden `.agents` / `.cursor` folders, so its zero proved nothing. Re-run with `--hidden`: one legitimate hit (Cursor hook payload field).
- Not done: 70 outline-drift entries stay listed for porting; enforcement matrix unchanged (no hook rows changed); integration PR not opened.

