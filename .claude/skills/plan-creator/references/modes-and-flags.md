# Plan Creator Modes and Flags

What each mode flag changes, and the constraints on `--spike`. Step 0 sets `planning_mode` from these flags or from the detected scope.

## Modes

| Flag | Mode | Research | Phase Files | Validation |
| --- | --- | --- | --- | --- |
| (default) | Auto-detect from scope | Follows mode | Follows mode | Follows mode |
| `--fast` | Fast | Skip | plan.md only | Semantic and structural checks |
| `--hard` | Hard | 2 researchers | plan.md + phases | Full interview |
| `--deep` | Deep | 2-3 researchers | plan.md + phases + bounded phase map: file inventory, test gaps, interfaces, dependencies | Full interview |
| `--parallel` | Parallel | 2 researchers | plan.md + phases + ownership matrix | Full interview |
| `--two` | Two approaches | 2 researchers | 2 approach files + trade-off matrix | After selection |
| `--product-level` | Product spec | 2 researchers (broader) | plan.md only (user stories + features + design language; NO phase files) | Semantic + check-product-spec.sh (no red team or interview; `mk:autobuild` decomposes the work) |
| `--spike` | Time-boxed investigation | Skip | spike plan from `assets/spike-plan-template.md` (investigate + findings phases; NO test/ship) | Semantic and structural checks |

## `--spike` constraints

Agile context only — gated by `agile-feedback-cycle.md` 2 when loaded.

- Requires `--timebox <duration>` (e.g., `--timebox 2d`, `--timebox 4h`); reject with "spike requires --timebox" if absent
- Sets plan frontmatter `spike: true`, `timebox:`, and `findings_doc:` (default `tasks/plans/{slug}/findings.md`)
- INCOMPATIBLE with `--product-level` and `mk:autobuild` FULL density (autobuild gate breaks). Reject combination "spike incompatible with autobuild FULL — use --fast or mk:cook"
- Advisory cap: warn if `story_points > 5` — likely two spikes, or spike + story
