---
title: "mk:rubric"
description: "Rubric library API — load, list, compose, and validate graded evaluation rubrics with PASS/WARN/FAIL grading and balanced anchor examples."
---

# mk:rubric

Discovery, composition, and validation API for the rubric library at `.claude/rubrics/`. Consumed by the `evaluator` agent and `mk:evaluate` skill. Independently invokable via `/mk:rubric <subcommand>` for manual inspection, validation, or composition outside the evaluator workflow.

## What This Skill Does

- Lists all available rubrics and presets in the library
- Loads individual rubrics as prompt-ready fragments for injection into evaluator prompts
- Composes rubric presets (frontend-app, backend-api, cli-tool, fullstack-product) with their member rubrics and weights
- Validates rubric schema conformance and preset weight sums
- Enforces balanced PASS/FAIL few-shot anchor examples to prevent evaluator bias

## When to Use

Activate when:
- User runs `/mk:rubric [subcommand]`
- An evaluator subagent needs to load rubrics for grading
- Sprint-contract negotiation references a rubric by path
- CI validates rubric schema conformance after edits

## Core Capabilities

### Subcommands

| Subcommand | Purpose | Output |
|---|---|---|
| `list` | List all available rubrics + presets | Table: name, weight_default, applies_to |
| `load <name>` | Load a single rubric and emit prompt-ready fragment | Markdown block ready to inject into evaluator prompt |
| `compose <preset>` | Load a composition preset and return all member rubrics + weights | Composed prompt fragment with weight table |
| `validate [path]` | Validate one rubric (or all if no path) against schema.md | PASS / FAIL with diagnostics |
| `validate --preset [path]` | Validate composition preset (weights sum to 1.0 +-0.01) | PASS / FAIL |

### Presets

| Preset | Loads | Use for |
|---|---|---|
| `frontend-app` | product-depth, functionality, design-quality, originality | SPAs, MPAs |
| `backend-api` | product-depth, functionality, code-quality | APIs, services |
| `cli-tool` | functionality, product-depth, code-quality, ux-usability | CLI tools |
| `fullstack-product` | All 7 rubrics (ux-usability weighted 3x) | End-to-end products |

**Frontend default is pruned to 4 rubrics** per Phase 2 v2.0.0 -- product-depth, functionality, design-quality, originality. Do NOT auto-load code-quality, craft, or ux-usability for frontend targets -- they overlap existing kit layers.

### Rubric Schema

All rubrics MUST conform to `.claude/rubrics/schema.md`. The validator enforces:
- Required frontmatter fields (`name`, `version`, `weight_default`, `applies_to`, `hard_fail_threshold`)
- Required sections in order: Intent, Criteria, Grading, Anti-patterns, Few-Shot Examples
- >=1 PASS + >=1 FAIL anchor example, balanced (+-1)
- File <=200 lines

Composition presets MUST have all weights summing to 1.0 +-0.01.

### Output Schema

**`load <name>` output:**

```markdown
## Rubric: {name} (weight: {weight_default}, hard_fail: {threshold})

{Intent paragraph}

### Criteria
{bullets}

### Grading
{table}

### Anti-patterns
{bullets}

### Few-Shot Examples
{PASS + FAIL examples, balanced}
```

**`compose <preset>` output:**

```markdown
## Composition: {preset-name}

| Rubric | Weight | Hard-Fail Threshold |
|---|---|---|
| ... | ... | ... |

(All member rubrics inlined below)
```

### Calibration (from `references/calibration-guide.md`)

Few-shot anchor examples are the highest-leverage part of a rubric. They must follow three rules:

1. **Balance PASS and FAIL counts** -- With 2-3 total examples: tolerance +-1. With 4+ total examples: exact equality required. Imbalanced counts produce positive bias (40-60% inflation observed in harness research).
2. **Randomize presentation order** -- Alternate PASS/FAIL by example number (PASS, FAIL, PASS, FAIL...). Models attend more to recent context.
3. **Pull from real prior reviews when possible** -- Synthetic examples are a lossy proxy. Source from `tasks/reviews/*-verdict.md`, the Anthropic harness article appendix, or anonymized QA failures. Tag synthetic examples with `<!-- synthetic -->`.

Anti-patterns are FIXED -- they trigger FAIL regardless of the surrounding criteria. Don't add subjective ones.

## Arguments

```
/mk:rubric list
/mk:rubric load <name>
/mk:rubric compose <preset>
/mk:rubric validate [path]
/mk:rubric validate --preset [path]
```

## Workflow

```
/mk:rubric <subcommand>
    |
    |-- list: run load-rubric.sh --list, display table
    |-- load: run load-rubric.sh <name>, emit prompt fragment
    |-- compose: run load-rubric.sh --preset <name>, emit composed fragment
    |-- validate: run validate-rubric.sh [path], report PASS/FAIL
    |-- validate --preset: validate weight sum = 1.0 +- 0.01
```

## Usage

```bash
# List all rubrics
rubric/scripts/load-rubric.sh --list

# Load one rubric
rubric/scripts/load-rubric.sh design-quality

# Compose a preset (returns all member rubrics + weight table)
rubric/scripts/load-rubric.sh --preset frontend-app

# Validate every rubric file in the library
rubric/scripts/validate-rubric.sh

# Validate a specific rubric
rubric/scripts/validate-rubric.sh path/to/rubric.md

# Validate a preset's weight sum
rubric/scripts/validate-rubric.sh --preset path/to/preset.md
```

**Path convention:** All commands assume cwd is `$CLAUDE_PROJECT_DIR`. Prefix paths with `"$CLAUDE_PROJECT_DIR/"` when invoking from subdirectories.

## Common Use Cases

- Composing the `frontend-app` preset for `mk:evaluate` to grade a generator-built SPA
- Validating a newly authored rubric against schema before committing
- Listing all available rubrics to discover what grading dimensions exist
- Checking that preset weight sums remain at 1.0 after changing a rubric's `weight_default`
- Adding a new rubric to the library: drop a `.md` file, run `validate-rubric.sh`, register weight in presets

## Example Prompt

> /mk:rubric compose frontend-app
> I need to evaluate a generator-built SPA. Load the frontend-app preset so I can grade it against product-depth, functionality, design-quality, and originality with balanced PASS/FAIL anchors.

## Pro Tips

- **Don't load all rubrics** -- the evaluator should load only the relevant preset, not the whole library. Context efficiency matters.
- **Weight drift:** if you change a rubric's `weight_default`, all presets that reference it must be re-checked for sum=1.0.
- **Adding a new rubric checklist:** frontmatter with all required fields, all 6 required sections, balanced anchors, alternating PASS/FAIL, concrete artifact descriptions, validate-rubric.sh passes, add to preset frontmatter and re-validate weight sum, add to RUBRICS_INDEX.md.
- **Re-calibrate per model upgrade:** when a new model tier rolls out, re-run anchors through the new model to verify it agrees with the stated verdicts. The Phase 8 benchmark suite (`mk:benchmark`) automates this.
- **Hard-fail semantic:** if any rubric hits its `hard_fail_threshold`, the overall verdict is FAIL regardless of weighted score. Soft averages do not save weak dimensions.
