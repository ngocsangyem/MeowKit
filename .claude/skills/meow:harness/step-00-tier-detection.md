# Step 0: Tier Detection + Density Selection

Pick the harness scaffolding density (`MINIMAL`, `FULL`, `LEAN`) based on the detected model tier. Create the run directory.

## Instructions

### 0a. Resolve density (priority order)

1. **`--tier` flag** (explicit): map `auto → run scale-routing`, `minimal → MINIMAL`, `full → FULL`, `lean → LEAN`
2. **`MEOWKIT_HARNESS_MODE` env var:** if set, overrides everything below. Log the override in step-06 audit trail.
3. **`density-select.sh`** (or invoke `meow:scale-routing` directly): emits the density token based on detected model + tier.

```bash
density=$(.claude/skills/meow:harness/scripts/density-select.sh)
```

The script returns one of: `MINIMAL`, `FULL`, `LEAN`. See `references/adaptive-density-matrix.md` for the full decision table.

### 0b. Capture model + tier metadata

For the run report. Use the same env var fallback chain as `density-select.sh` (POSIX parameter expansion, not echo trick):

```bash
model_id="${MEOWKIT_MODEL_HINT:-${CLAUDE_MODEL:-${ANTHROPIC_MODEL:-unknown}}}"

# Tier is derived from model independently — NOT aliased to density
# (density and tier are not 1:1: FULL maps to BOTH STANDARD and COMPLEX)
case "$model_id" in
  *haiku*) tier="TRIVIAL" ;;
  *sonnet*) tier="STANDARD" ;;
  *opus*) tier="COMPLEX" ;;
  *) tier="STANDARD" ;;  # safe fallback
esac
```

### 0c. Create the run directory

```bash
slug=$(echo "$task_description" | tr '[:upper:] ' '[:lower:]-' | sed -E 's/[^a-z0-9-]//g; s/--+/-/g; s/^-|-$//g' | cut -c1-40)
run_id=$(date +%y%m%d-%H%M)-${slug}
run_dir="tasks/harness-runs/${run_id}"
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

# Harness Run — {task_description}

## Density Decision
- Detected tier: {tier}
- Detected model: {model_id}
- Density: {density}
- Source: {scale-routing | env-override | --tier flag}
```

### 0e. Density routing

| density | Step-01 plan mode | Step-02 contract | Iteration loop |
|---|---|---|---|
| `MINIMAL` | `meow:plan-creator --fast` | SKIP | SKIP — invoke `meow:cook` instead and return |
| `FULL` | `meow:plan-creator --product-level` | REQUIRED | 1–3 rounds |
| `LEAN` | `meow:plan-creator --product-level` | OPTIONAL (skip if < 5 ACs needed) | 0–1 rounds |
| `DEEP` | `meow:plan-creator --deep` | REQUIRED | 1–3 rounds |

> **`--deep` mode:** Available for FULL density (Sonnet/Opus 4.5) when the task spans 5+ directories. Provides per-phase file inventory and dependency maps in addition to standard product-level scaffolding. Triggers automatically when `meow:scale-routing` detects 5+ root-level directories in scope; can also be forced via `MEOWKIT_HARNESS_MODE=DEEP`.

**MINIMAL short-circuit:** if density resolves to MINIMAL, the harness immediately delegates to `meow:cook` and exits — no contract, no iteration loop, no harness scaffolding. The run report still gets written to record the decision.

## Output

- `density`, `model_id`, `tier`, `run_id`, `run_dir` set as session variables
- `$run_dir/run.md` initialized with frontmatter + Density Decision section
- Print: `"Density: {density} ({model_id}). Run: {run_id}"`

## Next

If `density == MINIMAL` → invoke `/meow:cook "$task_description"` and proceed to step-06 (run report).

Otherwise → read and follow `step-01-plan.md`.
