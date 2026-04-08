# meow:evaluate — Workflow

5-step workflow for behavioral active verification of a running build against rubric criteria.

## Rules

- NEVER load multiple step files simultaneously
- ALWAYS read entire step file before execution
- NEVER skip steps — each step produces artifacts the next step needs
- ALWAYS halt at the active-verification gate (no PASS without evidence)
- ALWAYS reload `prompts/skeptic-persona.md` at session start (re-anchor before each criterion)

## Steps

1. `step-01-load-rubrics.md` — Compose rubric preset via `meow:rubric`, load skeptic persona, parse sprint contract if exists, build the criterion list (capped at 15)
2. `step-02-boot-app.md` — Start the build if a path was given; skip if already running at given URL; capture base URL + health check
3. `step-03-probe-criteria.md` — For each criterion: pick the right probe technique, drive the build, capture evidence, write a finding line. Loop with re-anchored skeptic persona
4. `step-04-grade-and-verdict.md` — Aggregate findings into per-rubric verdicts, compute weighted score, write verdict file, run `validate-verdict.sh`. Convert evidence-empty PASS → FAIL
5. `step-05-feedback-to-generator.md` — For each FAIL/WARN, produce one-line specific fix guidance. Emit handoff message + return PASS/WARN/FAIL to caller

## Variables Passed Between Steps

| Variable | Set by | Used by | Values |
|---|---|---|---|
| `target_type` | step-01 | step-02, step-03 | `frontend-url`, `backend-url`, `cli-binary`, `frontend-path`, `backend-path` |
| `rubric_preset` | step-01 | step-03, step-04 | `frontend-app`, `backend-api`, `cli-tool`, `fullstack-product` |
| `composed_rubrics` | step-01 | step-03, step-04 | List of {name, weight, hard_fail} from `load-rubric.sh --preset` |
| `criteria` | step-01 | step-03 | Flattened list, max 15 entries (split if more) |
| `base_url` | step-02 | step-03 | Running app URL (e.g., `http://localhost:3000`) |
| `evidence_dir` | step-01 | step-03, step-04 | Absolute path to `tasks/reviews/{slug}-evalverdict-evidence/` |
| `findings` | step-03 | step-04, step-05 | List of {criterion, verdict, evidence_path, reasoning} |
| `verdict_file` | step-04 | step-05 | Absolute path to written verdict file |
| `overall_verdict` | step-04 | step-05 | `PASS`, `WARN`, or `FAIL` |
| `feedback` | step-05 | caller | List of one-line fix-guidance strings |

## Flow

```
target arg + preset arg
    ↓
Step 1: Load Rubrics
    ├── Detect target type (URL vs path vs binary)
    ├── Default preset by target type if not given
    ├── meow:rubric compose <preset> → composed_rubrics
    ├── Read sprint contract if tasks/contracts/{slug}.md exists
    ├── Flatten criteria; cap at 15 (split if more)
    ├── Load skeptic-persona.md
    └── Create evidence_dir
         ↓
Step 2: Boot App (conditional)
    ├── If target is a URL → skip; verify reachable
    ├── If target is a path → start the build (npm/cargo/python/etc.)
    └── Capture base_url; health-check
         ↓
Step 3: Probe Criteria (loop)
    ├── For each criterion:
    │   ├── Re-anchor skeptic persona
    │   ├── Pick probe technique from active-verification-patterns.md
    │   ├── Drive the build (browser / curl / CLI)
    │   ├── Capture evidence (screenshot / response / transcript)
    │   ├── Pattern-match against rubric anchors
    │   └── Write finding to working list
    └── Cap at 15; spill to next session if exceeded
         ↓
Step 4: Grade and Verdict
    ├── Aggregate findings per rubric
    ├── Apply weights from composition
    ├── Check hard_fail thresholds
    ├── Compute weighted_score
    ├── Write verdict file (canonical schema)
    ├── Run validate-verdict.sh
    └── If validator rejects → fix or convert PASS → FAIL
         ↓
Step 5: Generator Feedback
    ├── For each FAIL/WARN: write one-line fix guidance
    ├── Emit handoff message to harness/caller
    └── Return overall_verdict + verdict_file path
```

## Mode Notes

- **Path target** triggers step-02 boot. **URL target** skips step-02.
- **Sprint contract** integration: if `tasks/contracts/{slug}.md` exists, step-01 reads it and uses its criteria as a SUBSET filter on the rubric composition. No contract = use full preset.
- **Max 15 criteria** is a hard cap. If `composed_rubrics` flatten produces more, step-01 splits into batches and step-04 merges verdicts.
- **Skip step-02** if `--no-boot` flag passed (target must be a URL).

## Next

Read and follow `step-01-load-rubrics.md`.
