# Step 1: Load Rubrics + Skeptic Persona

Compose the rubric preset, load the skeptic persona, parse the sprint contract if it exists, and build the criterion list (capped at 15 per session).

## Instructions

### 1a. Parse the target

The user passed `<target>` as a positional argument. Detect type:

| Pattern | `target_type` | Example |
|---|---|---|
| Starts with `http://` or `https://` | `frontend-url` (or `backend-url` if hint says API) | `http://localhost:3000` |
| Path ends in executable / has shebang | `cli-binary` | `./bin/mytool` |
| Path is a directory containing `package.json` / `pyproject.toml` / etc. | `frontend-path` or `backend-path` | `./apps/web` |

If ambiguous, ask the user via `AskUserQuestion`. Never guess.

### 1b. Default rubric preset by target type

If `--rubric-preset` flag was passed, use it. Otherwise default:

| target_type | Default preset |
|---|---|
| `frontend-url` / `frontend-path` | `frontend-app` |
| `backend-url` / `backend-path` | `backend-api` |
| `cli-binary` | `cli-tool` |
| (mixed full-stack — user-provided spec says so) | `fullstack-product` |

### 1c. Compose the rubric preset

Run the rubric library loader:

```bash
.claude/skills/meow:rubric/scripts/load-rubric.sh --preset "$rubric_preset"
```

This emits the composed prompt fragment with all member rubrics' bodies inlined. Capture stdout into `composed_rubrics` (working memory).

**Frontend default is pruned to 4 rubrics** per Phase 2 v2.0.0 — product-depth, functionality, design-quality, originality. Do NOT auto-load code-quality, craft, or ux-usability for frontend targets — they overlap existing kit layers (per audit 260408).

### 1d. Load the skeptic persona

Read `prompts/skeptic-persona.md` into working memory. **Re-anchor before each criterion grading in step-03** — leniency drift is the dominant evaluator failure mode. The persona is not a once-per-session read; it's a checkpoint.

### 1e. Parse sprint contract (if exists)

**Phase 4 — pending.** The sprint contract format is defined in Phase 4 of the harness plan and the `tasks/contracts/` directory does not exist as a registered canonical path until Phase 6 runs. Until both ship, treat any pre-existing contract file with caution.

Stub-guard logic:

```bash
contract_path="tasks/contracts/${slug}.md"
if [ -f "$contract_path" ]; then
  # Verify it has the Phase 4 schema marker before trusting it
  if grep -q '^contract_schema_version:' "$contract_path"; then
    # Phase 4 has shipped — read it and filter composed_rubrics by contract criteria
    echo "Sprint contract found at $contract_path — applying as criterion filter"
    # ... apply filter ...
  else
    # Stale file from before Phase 4 shipped — ignore with warning
    echo "WARN: $contract_path exists but lacks contract_schema_version marker; ignoring (Phase 4 not yet active)" >&2
  fi
fi
```

If no contract exists OR the file lacks the schema marker, use the full composed preset.

The filter logic itself lands when Phase 4 ships and defines `contract_schema_version`.

### 1f. Build the criterion list

Flatten the composed rubrics into a sequential criterion list:

```
[
  {rubric: "product-depth", criterion: "≥80% of spec features implemented", anchor_pass: "...", anchor_fail: "..."},
  {rubric: "product-depth", criterion: "Each feature works end-to-end on real input", ...},
  ...
]
```

**Hard cap: 15 criteria per session** (research-01 §4 — context overflow above this).

If the flatten produces > 15 entries:
1. Split into batches of 15 by criterion priority (hard-fail rubrics first)
2. Note in working state: `batches_total`, `batch_index = 1`
3. Step-04 will merge verdicts across batches
4. If > 3 batches needed, escalate to user — the rubric composition is too large

### 1g. Determine the slug + create the evidence directory

**Slug source priority** (use the first that resolves):

1. Task slug from the active plan (read from `tasks/plans/*/plan.md` frontmatter `slug:` field if a current plan is identifiable)
2. Sprint contract slug (if `tasks/contracts/{slug}.md` was found in 1e)
3. Branch name slug (`git rev-parse --abbrev-ref HEAD` → kebab-case)
4. Fallback: `basename "$(pwd)"` (lowest priority — only when none of the above work)

This same priority order MUST be used by step-04 when writing the verdict file path. Drift between step-01's evidence dir and step-04's verdict path corrupts the evidence-citation relative paths.

```bash
# Resolve slug per priority above
slug="${task_slug:-${contract_slug:-${branch_slug:-$(basename "$(pwd)")}}}"
date_prefix=$(date +%y%m%d)
evidence_dir="tasks/reviews/${date_prefix}-${slug}-evalverdict-evidence"
mkdir -p "$evidence_dir"

# Persist for step-04 to read — same value, no re-derivation
export MEOWKIT_EVAL_SLUG="${date_prefix}-${slug}"
```

Store `evidence_dir` as an absolute path. Step-03 writes screenshots/captures here. Step-04 reads `MEOWKIT_EVAL_SLUG` to derive the verdict file path — never re-derives the slug independently.

## Output

Set the following session variables for downstream steps:
- `target_type`
- `rubric_preset`
- `composed_rubrics`
- `criteria` (max 15 per batch)
- `evidence_dir` (absolute path)
- `batches_total`, `batch_index` (if criteria split)

Print: `"Loaded preset {rubric_preset} ({N} criteria). Target: {target_type}. Evidence: {evidence_dir}"`

## Next

If `target_type` ends in `-url` and `--no-boot` was passed → skip to `step-03-probe-criteria.md`.
Otherwise → read and follow `step-02-boot-app.md`.
