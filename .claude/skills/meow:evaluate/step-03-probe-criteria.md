# Step 3: Probe Each Criterion

For each criterion in the loaded list, drive the running build via active verification, capture concrete evidence, and write a finding line. Re-anchor the skeptic persona before each grading.

## Instructions

### 3a. Loop setup

```
findings = []
for criterion in criteria:
    re-load skeptic-persona.md  # leniency drift mitigation
    pick probe technique (see references/active-verification-patterns.md)
    drive the build
    capture evidence
    grade against rubric anchors (NOT intuition)
    record finding
```

The list is at most 15 criteria — single session. If `batches_total > 1` was set in step-01, this step runs once per batch.

### 3b. Pick the probe technique

Read `references/active-verification-patterns.md` once at session start. For each criterion, match the criterion type to a probe pattern:

| Criterion type | Probe pattern | Tool |
|---|---|---|
| "Feature X works end-to-end" | UI flow: navigate → click → type → assert visible result | `meow:agent-browser` or `meow:playwright-cli` |
| "API endpoint returns expected shape" | curl + jq assertion on response shape | `bash` |
| "Form submission persists data" | UI flow + DB query (or follow-up GET) | `meow:agent-browser` + `bash` |
| "Error states render gracefully" | Trigger error (bad input, network kill) → screenshot result | `meow:agent-browser` |
| "Time-to-value ≤90s" | Navigate to landing → measure clicks/seconds to first value action | `meow:agent-browser` (timed) |
| "No console errors on happy path" | Open page → exercise main flow → capture browser console log | `meow:agent-browser` (log capture) |
| "Design language consistent across screens" | Screenshot every primary screen → compare visually for typography/color/spacing | `meow:agent-browser` (multi-screenshot) |
| "Originality — non-generic copy" | Read hero copy + product name → pattern-match against `originality.md` anti-patterns (purple gradient, "modern way to", undraw illustrations) | `meow:agent-browser` + manual pattern-match |
| "CLI exit codes correct" | Invoke binary with intentional bad input → check exit code | `bash` |
| "CLI --help is comprehensive" | Run `binary --help` → capture stdout → check for examples + exit codes section | `bash` |

### 3c. Capture evidence

Every probe MUST produce a concrete artifact in `$evidence_dir`. Naming convention:

```
{rubric}-{criterion-slug}-{verdict}.{ext}
```

Examples:
- `functionality-form-submit-PASS.png`
- `design-quality-button-hover-FAIL.png`
- `originality-hero-copy-FAIL.txt`
- `product-depth-feature-7-missing-WARN.log`

The evidence file is the source of truth. The verdict line in step-04 cites the path.

### 3d. Grade against anchors, not intuition

For each criterion, the rubric ships PASS and FAIL anchor examples (`### Example N — PASS` / `### Example N — FAIL` blocks in the rubric file). Pattern-match the captured artifact against the anchors:

1. Read the rubric's PASS anchor — does the artifact look like that?
2. Read the rubric's FAIL anchor — does the artifact look like that?
3. If neither matches cleanly → WARN (the honest middle), not PASS

**If you catch yourself thinking "this looks acceptable," check the anchors.** Anchor pattern match is the only valid grading evidence. Vibes are leniency drift.

### 3e. Record the finding

Append to working `findings` list:

```yaml
- rubric: functionality
  criterion: "Form submission persists data"
  verdict: FAIL
  evidence_path: tasks/reviews/{slug}-evalverdict-evidence/functionality-form-submit-FAIL.png
  reasoning: |
    Submitted form with name="test" email="test@example.com".
    Server responded 201 OK with body {"id": 42}.
    Refreshed page — submitted record does NOT appear in the list.
    GET /api/items returns the empty array. Persistence broken.
    Pattern-matched against functionality.md FAIL anchor: "Active verification (curl) failed."
  fix_guidance: |
    Check item creation handler — write to DB is missing or failing silently.
    Inspect server logs for write errors. Confirm DB connection is live.
```

### 3f. Skeptic persona re-anchor checkpoint

**Before grading each criterion**, re-read the relevant section of `prompts/skeptic-persona.md`. This is not optional. Leniency drift accumulates over a session — the persona needs explicit re-anchoring.

The re-anchor check: ask yourself before writing a verdict:
- "Am I marking PASS because the anchor matches, or because I'm tired of finding bugs?"
- "Did I capture concrete evidence, or am I about to write a narrative-only finding?"
- "If a stranger read this verdict line, would they trust the PASS without re-checking?"

If any answer is "no," re-probe.

### 3g. Cap and overflow

Hard cap: 15 criteria probed. If criteria list has more (set in step-01 as multi-batch), stop here and signal step-04 to merge with prior batches.

## Output

- `findings` — list of finding objects (rubric, criterion, verdict, evidence_path, reasoning, fix_guidance)
- Evidence files written to `$evidence_dir`

Print per criterion: `"[{rubric}] {criterion} — {verdict}"` (one line each, batched at end if too noisy).

## Next

Read and follow `step-04-grade-and-verdict.md`.
