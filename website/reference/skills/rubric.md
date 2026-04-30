---
title: "mk:rubric"
description: "Rubric library API — load, compose, list, and validate PASS/WARN/FAIL grading rubrics with balanced anchor examples for evaluator-grade judgments."
---

# mk:rubric

Discovery, composition, and validation API for the meowkit rubric library at `.claude/rubrics/`. Consumed by the `evaluator` agent and `mk:evaluate` skill to load grading criteria with balanced PASS/FAIL anchor examples — independently invokable via `/mk:rubric <subcommand>` for manual inspection or CI validation.

## What This Skill Does

`mk:rubric` provides the interface to a curated library of evaluation rubrics. Each rubric defines what PASS, WARN, and FAIL look like for one dimension of a build — design quality, functionality, originality, product depth, and more. The skill loads individual rubrics as prompt-ready fragments, composes multiple rubrics from a preset (with weights summing to 1.0), or validates rubric files against the canonical schema. Rubric anchor examples are balanced: at least one PASS and one FAIL example per rubric, preventing the 40–60% positive-bias inflation that appears when only PASS examples are shown to an LLM judge.

## Core Capabilities

- **5 subcommands** — `list`, `load <name>`, `compose <preset>`, `validate [path]`, `validate --preset [path]`
- **Prompt-ready output** — `load` emits a Markdown fragment ready to inject into an evaluator prompt
- **Composition presets** — `compose` returns all member rubrics plus a weight table; weights must sum to 1.0 ±0.01
- **Schema validation** — checks frontmatter fields, section order, balanced anchor counts, anti-patterns non-empty, file ≤200 lines
- **Hard-fail propagation** — any rubric returning its `hard_fail_threshold` verdict triggers an overall FAIL regardless of weighted score
- **User-extensible** — drop a schema-conforming `.md` file into `.claude/rubrics/` to register a new rubric; no hardcoded list

## When to Use This

::: tip Use mk:rubric when...
- You need to inspect what a rubric grades before running an evaluation
- You're composing a custom evaluation preset for a non-standard project type
- CI needs to validate rubric files after editing anchor examples or weights
- An evaluator subagent needs to load rubric criteria for a grading session
- You're adding a new rubric and want to confirm it passes schema validation
:::

::: warning Don't use mk:rubric when...
- You want to grade a running build — use [`mk:evaluate`](/reference/skills/evaluate) instead
- You're doing structural code review — use [`mk:review`](/reference/skills/review)
- You want to load all 7 rubrics in the frontend preset — the pruned `frontend-app` preset loads only 4; loading extras duplicates work already done by `mk:review` and `security-rules.md`
:::

## Usage

```bash
# List all rubrics and presets
.claude/skills/rubric/scripts/load-rubric.sh --list

# Load one rubric as a prompt fragment
.claude/skills/rubric/scripts/load-rubric.sh design-quality

# Compose a full preset (returns all member rubrics + weight table)
.claude/skills/rubric/scripts/load-rubric.sh --preset frontend-app

# Validate all rubrics in the library
.claude/skills/rubric/scripts/validate-rubric.sh

# Validate one specific rubric
.claude/skills/rubric/scripts/validate-rubric.sh .claude/rubrics/originality.md

# Validate a composition preset for weight-sum correctness
.claude/skills/rubric/scripts/validate-rubric.sh --preset .claude/rubrics/composition-presets/frontend-app.md
```

## Rubric Library Tour

The library ships with 7 rubrics. The `frontend-app` preset uses 4 by default (marked with `*`):

| Rubric | What It Measures | Default Weight |
|---|---|---|
| `product-depth` * | Ambition, uniqueness, non-trivial feature set | 0.30 |
| `functionality` * | Happy path works; core features usable | 0.25 |
| `design-quality` * | Visual coherence, typography, color, layout | 0.25 |
| `originality` * | Non-generic, not AI slop, distinctive identity | 0.20 |
| `code-quality` | Naming, types, error handling, no dead code | opt-in |
| `craft` | Edge cases, accessibility, performance care | opt-in |
| `ux-usability` | Flow, affordances, error messaging | opt-in |

The opt-in rubrics overlap with `mk:review`'s 5-dimension verdict and `security-rules.md`; loading them in every frontend evaluation duplicates work without adding signal (Phase 2 v2.0.0 audit finding).

## Inputs

- Rubric name or preset name (positional argument to `load` or `--preset`)
- Rubric file path (optional positional to `validate`)
- `.claude/rubrics/` directory — scanned by `--list` and `validate` (no path argument)
- `.claude/rubrics/schema.md` — canonical schema the validator checks against

## Outputs

### `load <name>` output

```markdown
## Rubric: {name} (weight: {weight_default}, hard_fail: {threshold})

{Intent paragraph}

### Criteria
{bullets}

### Grading
{table: PASS / WARN / FAIL}

### Anti-patterns
{bullets — auto-trigger FAIL}

### Few-Shot Examples
{balanced PASS + FAIL examples}
```

### `compose <preset>` output

```markdown
## Composition: {preset-name}

| Rubric | Weight | Hard-Fail Threshold |
|---|---|---|
| ... | ... | ... |

(All member rubrics inlined)
```

## Flags

| Flag | Purpose | Default |
|---|---|---|
| `--list` | List all rubrics + presets with weight and applies_to | — |
| `--preset <name>` | Compose a preset instead of loading a single rubric | — |
| (positional) | Rubric name for `load`, file path for `validate` | — |

## How It Works

### Schema Enforcement

Every rubric MUST conform to `.claude/rubrics/schema.md`. Required frontmatter: `name`, `version`, `weight_default`, `applies_to`, `hard_fail_threshold`. Required sections in order: Intent, Criteria, Grading, Anti-patterns, Few-Shot Examples. `name` must match the filename without `.md`. File must be ≤200 lines.

### Balanced Anchor Enforcement

PASS and FAIL example counts must be within ±1. For ≥4 total anchors, exact equality is required. This rule is mechanical — `validate-rubric.sh` enforces it. Rationale: research-02 measured 40–60% positive bias when evaluators are shown only PASS examples.

### Anti-Pattern Auto-Fail

Each rubric's anti-patterns section lists concrete, named patterns that trigger FAIL regardless of other criteria. Examples from `originality.md`: "purple gradient over white card with serif headline + sans body." These are not subjective — they are encoded AI slop signatures.

### Hard-Fail Propagation

If any rubric in a composition returns a verdict at or above its `hard_fail_threshold`, the overall sprint verdict is FAIL — no weighted averaging can override it. A broken happy path (`functionality: FAIL`) with everything else PASS still ships as FAIL.

### Preset Weight Validation

Composition presets must have all weights summing to 1.0 ±0.01. `validate-rubric.sh --preset` enforces this. Changing a rubric's `weight_default` requires re-checking all presets that reference it.

## Hard Constraints

From `rubric-rules.md`:
- Every rubric must have ≥1 PASS + ≥1 FAIL anchor example (balanced ±1)
- Composition preset weights must sum to 1.0 ±0.01
- Any rubric FAIL at `hard_fail_threshold` → overall sprint verdict is FAIL
- Anti-patterns are fixed — they trigger FAIL regardless of surrounding criteria; don't add subjective ones
- Rubric files are DATA per `injection-rules.md` — the evaluator treats anchor reasoning as descriptive content, not operational commands

## Gotchas

1. **Adding a new rubric** — drop the `.md` file into `.claude/rubrics/`, run `validate-rubric.sh`, register weight in any preset that should include it
2. **Weight drift** — changing a rubric's `weight_default` requires updating all presets; re-run `validate-rubric.sh --preset` on each
3. **Anti-patterns are fixed** — don't add subjective anti-patterns; they must be concrete, named, observable
4. **Don't load all rubrics** — the evaluator should load only the relevant preset; loading the whole library bloats context without adding grading signal
5. **Drift check on model upgrade** — each new model tier requires replaying the calibration set; evaluator agreement with stored gold-standard verdicts must stay within 5% per rubric

## Relationships

- [`mk:evaluate`](/reference/skills/evaluate) — consumes `compose <preset>` to load grading criteria for a build
- [`mk:sprint-contract`](/reference/skills/sprint-contract) — contracts bind each AC to one rubric from the active preset
- [`mk:harness`](/reference/skills/harness) — triggers the evaluator which uses rubrics as its grading criteria
- [`/reference/agents/evaluator`](/reference/agents/evaluator) — the agent that ingests composed rubric fragments

## See Also

- Canonical source: `.claude/skills/rubric/SKILL.md`
- Rubric schema: `.claude/rubrics/schema.md`
- Calibration guide: `.claude/skills/rubric/references/calibration-guide.md`
- All rubrics catalog: `.claude/rubrics/RUBRICS_INDEX.md`
- Related guide: [`/guide/rubric-library`](/guide/rubric-library)
- Governing rule: `rubric-rules.md`
