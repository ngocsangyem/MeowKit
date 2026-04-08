# MeowKit Rubric Library — Index

Catalog of all evaluation rubrics and composition presets used by the evaluator agent (Phase 3) and `meow:rubric` skill.

> Generated reference. To regenerate, run:
> `.claude/skills/meow:rubric/scripts/load-rubric.sh --list`

## Rubrics

| Rubric | Weight (default) | Hard-Fail | Applies To | Calibration |
|---|---|---|---|---|
| `product-depth` | 0.25 | FAIL | frontend, backend, fullstack, cli | seeded (Anthropic article) |
| `functionality` | 0.25 | FAIL | frontend, backend, fullstack, cli, library, data-pipeline | seeded |
| `design-quality` | 0.15 | FAIL | frontend, fullstack | seeded (anti-slop signatures) |
| `originality` | 0.15 | FAIL | frontend, fullstack | seeded (anti-slop signatures) |
| `code-quality` | 0.10 | FAIL | frontend, backend, fullstack, cli, library, data-pipeline | seeded |
| `craft` | 0.05 | WARN | frontend, backend, fullstack, cli | seeded |
| `ux-usability` | 0.05 | WARN | frontend, fullstack, cli | seeded |

**Total weight (sum if all loaded):** 1.00

## Composition Presets

| Preset | Loads | Excludes | Use Case |
|---|---|---|---|
| `frontend-app` (v2.0.0) | product-depth, functionality, design-quality, originality (4 distinctive rubrics) | code-quality, craft, ux-usability — overlap meow:review/security-rules/qa health-score; opt-in only | Browser-rendered apps (SPA, MPA, framework apps) |
| `backend-api` | product-depth, functionality, code-quality | design-quality, originality, craft, ux-usability (no visual surface) | Headless APIs, services, workers (no UI) |
| `cli-tool` | functionality, product-depth, code-quality, ux-usability | design-quality, originality, craft (CLI has no visual surface; craft folded into ux-usability) | CLI binaries, npm CLIs, shell utilities |
| `fullstack-product` | All 7 rubrics, ux-usability weighted 3x higher | — | End-to-end product builds (UI + backend + persistence) |

> **Pruning rationale (260408):** `frontend-app` was pruned from 7→4 rubrics per the necessity audit (`plans/reports/red-team-260408-1117-rubric-necessity-audit.md`). The 3 excluded rubrics overlap existing meowkit layers (review 5-dim verdict, security-rules, qa health-score). Each retained rubric closes a verified gap the rest of the ecosystem doesn't catch.

## Schema

All rubrics conform to `schema.md`. Validator: `.claude/skills/meow:rubric/scripts/validate-rubric.sh`.

## Adding a Custom Rubric

1. Drop a `.md` file into `.claude/rubrics/` following the schema
2. Run `validate-rubric.sh path/to/new-rubric.md`
3. Optionally register in a composition preset (re-validate weight sum after)
4. Add a row to this index

See `meowkit/.claude/skills/meow:rubric/references/calibration-guide.md` for anchor-example rules.

## Hard-Fail Semantics

`hard_fail_threshold` defines which verdict level triggers an overall sprint FAIL:

- `FAIL` — only an explicit FAIL verdict triggers sprint FAIL (standard)
- `WARN` — both WARN and FAIL trigger sprint FAIL (used for safety-critical rubrics; not currently used)

In a composition, **any single rubric returning a verdict ≥ its hard_fail_threshold fails the entire sprint**, regardless of other rubrics' scores. Soft averages do not save weak dimensions.

## Files

```
.claude/rubrics/
├── RUBRICS_INDEX.md             ← this file
├── schema.md                    ← canonical rubric format spec
├── product-depth.md
├── functionality.md
├── design-quality.md
├── originality.md
├── craft.md
├── code-quality.md
├── ux-usability.md
└── composition-presets/
    ├── frontend-app.md
    ├── backend-api.md
    ├── cli-tool.md
    └── fullstack-product.md
```

## Versioning

Rubrics use SemVer in their frontmatter. Bump `version`:

- **PATCH** — anchor example added/updated, anti-pattern clarified, no semantic change
- **MINOR** — criteria added or threshold adjusted (backward-compatible for callers)
- **MAJOR** — breaking change to grading semantics or schema

## References

- Phase 2 plan: `plans/260407-2331-meowkit-harness-gan-architecture/phase-02-graded-evaluation-rubric-library.md`
- Phase 3 (consumer): the `evaluator` agent (lands in Phase 3 — pending)
- Phase 6: registers `.claude/rubrics/` in `meowkit-rules.md` §1 canonical paths table (pending — until then, this directory is convention-only, not in the canonical table)
- Calibration: `meowkit/.claude/skills/meow:rubric/references/calibration-guide.md`
