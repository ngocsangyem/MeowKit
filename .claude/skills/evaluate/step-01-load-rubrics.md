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

If ambiguous, ask the user. Never guess.

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
../rubric/scripts/load-rubric.sh --preset "$rubric_preset"
```

This emits the composed prompt fragment with all member rubrics' bodies inlined. Capture stdout into `composed_rubrics` (working memory).

**Frontend default is pruned to 4 rubrics**: product-depth, functionality, design-quality, originality. Do not auto-load code-quality, craft or ux-usability for frontend targets; they overlap `mk:review` and the security rules.

### 1d. Load the skeptic persona

Read `prompts/skeptic-persona.md` into working memory. Leniency drift is the dominant evaluator failure mode, so reload it at the start of each batch in step 3 and before writing each PASS.

### 1e. Use the sprint contract (if signed)

`mk:sprint-contract` writes signed contracts to `tasks/contracts/{date}-{slug}-sprint-{N}.md`. List `tasks/contracts/*-{slug}-sprint-*.md`; if a signed contract exists, use its acceptance criteria as the filter over `composed_rubrics`. Otherwise use the full composed preset.

### 1f. Build the criterion list

Flatten the composed rubrics into a sequential criterion list:

```
[
  {rubric: "product-depth", criterion: "≥80% of spec features implemented", anchor_pass: "...", anchor_fail: "..."},
  {rubric: "product-depth", criterion: "Each feature works end-to-end on real input", ...},
  ...
]
```

**Hard cap: 15 criteria per session** (heuristic — context overflow risk above this threshold).

If the flatten produces > 15 entries:
1. Split into batches of 15 by criterion priority (hard-fail rubrics first)
2. Note in working state: `batches_total`, `batch_index = 1`
3. Step-04 will merge verdicts across batches
4. If > 3 batches needed, escalate to user — the rubric composition is too large

### 1g. Determine the slug + create the evidence directory

**Slug source priority** (use the first that resolves):

1. Task slug from the active plan (read from `tasks/plans/*/plan.md` frontmatter `slug:` field if a current plan is identifiable)
2. Sprint contract slug (from the `tasks/contracts/*-{slug}-sprint-*.md` filename, if one was found in 1e)
3. Branch name slug (`git rev-parse --abbrev-ref HEAD` → kebab-case)
4. Fallback: `basename "$(pwd)"` (lowest priority — only when none of the above work)

```bash
# Resolve slug per priority above
slug="${task_slug:-${contract_slug:-${branch_slug:-$(basename "$(pwd)")}}}"
date_prefix=$(date +%y%m%d)
evidence_dir="tasks/reviews/${date_prefix}-${slug}-evalverdict-evidence"
mkdir -p "$evidence_dir"
```

The slug is not kept in a shell variable, because each tool call starts a fresh shell. The evidence directory's name carries it: step 4 derives the verdict path by replacing the trailing `-evalverdict-evidence` with `-evalverdict.md`.

Store `evidence_dir` as an absolute path. Step 3 writes screenshots and captures here; step 4 reads the directory name to derive the verdict path and does not re-derive the slug.

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
