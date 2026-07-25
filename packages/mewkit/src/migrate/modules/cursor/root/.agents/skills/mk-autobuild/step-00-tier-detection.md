# Step 0: Tier Detection + Density Selection

Pick the autobuild scaffolding density (`MINIMAL`, `FULL`, `LEAN`) based on the detected model tier. Create the run directory.

## Instructions

### 0a. Resolve density (priority order)

1. **`--tier` flag** (explicit): map `auto → run scale-routing`, `minimal → MINIMAL`, `full → FULL`, `lean → LEAN`. Set `resolved_tier` to the matching TRIVIAL/STANDARD/COMPLEX value.
2. **`MEOWKIT_AUTOBUILD_MODE` env var:** if set, overrides everything below. Log the override in step-06 audit trail.
3. **`density-select.sh`** (or invoke `mk:scale-routing` directly): emits the density token. There is no model string to read (see 0b), so absent an explicit `--tier`/env override this resolves to the safe `STANDARD` → `FULL` fallback.

```bash
density=$(.agents/skills/autobuild/scripts/density-select.sh)
```

The script returns one of: `MINIMAL`, `FULL`, `LEAN`. See `references/adaptive-density-matrix.md` for the full decision table.

### 0b. Capture model + tier metadata

For the run report. A Cursor custom agent's `model` field is `inherit` — there is no
session env var exposing the underlying model id to this bundle's scripts, so `model_id`
is captured as a label, not detected:

```bash
model_id="${MEOWKIT_MODEL_HINT:-inherit (not detectable)}"

# Tier is NOT derived from a model string here (none is available). Tier comes
# directly from whichever source won in 0a (--tier flag > MEOWKIT_AUTOBUILD_MODE >
# density-select.sh's safe STANDARD fallback). Density and tier are not 1:1:
# FULL maps to BOTH STANDARD and COMPLEX.
tier="${resolved_tier:-STANDARD}"
```

### 0c. Create the run directory

```bash
slug=$(echo "$task_description" | tr '[:upper:] ' '[:lower:]-' | sed -E 's/[^a-z0-9-]//g; s/--+/-/g; s/^-|-$//g' | cut -c1-40)
run_id=$(date +%y%m%d-%H%M)-${slug}
run_dir="tasks/autobuild-runs/${run_id}"
mkdir -p "$run_dir"
```

Persist `run_id`, `run_dir`, `density`, `model_id`, `tier` for downstream steps.

### 0d. Initialize the run report stub

Write the frontmatter block to `$run_dir/run.md` so subsequent steps can append:

```markdown
---
run_id: {run_id}
density: {MINIMAL|FULL|LEAN}
model: {model_id}
budget_cap: {budget_cap}
budget_spent: 0.00
iterations: 0
status: in_progress
started: {ISO-8601 timestamp}
---

# Autobuild Run — {task_description}

## Density Decision
- Tier: {tier}
- Model: {model_id}
- Density: {density}
- Source: {scale-routing | env-override | --tier flag}
```

### 0e. Density routing

| density | Step-01 plan mode | Step-02 contract | Iteration loop |
|---|---|---|---|
| `MINIMAL` | `mk:plan-creator --fast` | SKIP | SKIP — invoke `mk:cook` instead and return |
| `FULL` | `mk:plan-creator --product-level` | REQUIRED | 1–3 rounds |
| `LEAN` | `mk:plan-creator --product-level` | OPTIONAL (skip if < 5 ACs needed) | 0–1 rounds |

`--deep` remains a plan-creator/cook planning mode. It is not an autobuild density and cannot be forced through `MEOWKIT_AUTOBUILD_MODE`.

**MINIMAL short-circuit:** if density resolves to MINIMAL, the autobuild workflow immediately delegates to `mk:cook` and exits — no contract, no iteration loop, no autobuild scaffolding. The run report still gets written to record the decision.

## Output

- `density`, `model_id`, `tier`, `run_id`, `run_dir` set as session variables
- `$run_dir/run.md` initialized with frontmatter + Density Decision section
- Print: `"Density: {density} ({model_id}). Run: {run_id}"`

## Next

If `density == MINIMAL` → invoke `the cook skill "$task_description"` and proceed to step-06 (run report).

Otherwise → read and follow `step-01-plan.md`.
