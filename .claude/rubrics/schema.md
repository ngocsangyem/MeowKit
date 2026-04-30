---
name: rubric-schema
version: 1.0.0
purpose: canonical-format-spec
---

# Rubric Schema — Canonical Format

This document defines the schema every rubric file in `.claude/rubrics/` MUST follow. It is enforced by `mk:rubric/scripts/validate-rubric.sh`.

## File Naming

- kebab-case, descriptive: `design-quality.md`, `code-quality.md`, `ux-usability.md`
- Located at `.claude/rubrics/<name>.md`
- Composition presets at `.claude/rubrics/composition-presets/<preset>.md`

## Required Frontmatter

```yaml
---
name: {kebab-case-rubric-name}      # MUST match filename without .md
version: 1.0.0                       # SemVer
weight_default: 0.15                 # Default weight in compositions; float 0.0-1.0
applies_to: [frontend, fullstack]    # Project types where this rubric is relevant
hard_fail_threshold: FAIL            # Verdict level that triggers overall sprint FAIL
---
```

**Field rules:**
- `name` MUST equal the filename (without `.md`)
- `weight_default` MUST be a float between `0.0` and `1.0`
- `applies_to` MUST be a non-empty list from: `frontend`, `backend`, `fullstack`, `cli`, `library`, `data-pipeline`
- `hard_fail_threshold` MUST be one of: `WARN`, `FAIL` (FAIL is the standard; WARN is for safety-critical rubrics)

## Required Sections (in order)

### `# {Rubric Title}`

Single H1 — Title Case, descriptive.

### `## Intent`

One paragraph (3-5 sentences). What this rubric measures and why it matters. Reference the failure mode it prevents.

### `## Criteria`

Bulleted list. Each criterion is specific, testable, and behavior-facing.

- ❌ "Code is clean"
- ✅ "All public functions have explicit return types"

### `## Grading`

Three-row table with PASS / WARN / FAIL definitions. Conditions MUST be testable, not subjective.

```markdown
| Level | Definition |
|---|---|
| PASS | {objective, testable condition} |
| WARN | {specific degradation — what's missing} |
| FAIL | {hard-fail condition} |
```

### `## Anti-patterns`

Bulleted list of explicit, named anti-patterns that auto-trigger FAIL. Be concrete.

- ❌ "Looks generic"
- ✅ "Purple gradient over white card with serif headline + sans body (default AI slop)"

### `## Few-Shot Examples`

At least one PASS example AND at least one FAIL example. Format:

```markdown
### Example {N} — {VERDICT}

**Artifact:** {screenshot path / code snippet / URL / description}
**Verdict:** PASS | WARN | FAIL
**Reasoning:** {explicit grading logic — why this verdict, citing criteria}
```

**Balance rule:** PASS and FAIL example counts MUST be equal (within ±1) per `validate-rubric.sh`. This prevents positive bias in evaluator few-shot prompting (observed: balanced examples reduce positive bias by 40-60% — Anthropic harness research).

## Optional Sections

- `## Tier-Specific Notes` — calibration notes for TRIVIAL / STANDARD / COMPLEX model tiers
- `## References` — links to research or prior reviews
- `## Changelog` — version bumps + reason

## Validator Enforcement

`validate-rubric.sh` checks:

1. Frontmatter has all 5 required fields with valid values
2. `name` matches filename
3. All 6 required sections exist in order
4. ≥1 PASS example AND ≥1 FAIL example (balance within ±1)
5. Anti-patterns section is non-empty
6. File is ≤200 lines total

Schema violations exit non-zero with diagnostics on stderr.

## Composition Preset Schema

Preset files in `composition-presets/` use a different schema:

```yaml
---
name: {preset-name}
version: 1.0.0
applies_to: [frontend]
description: {one-line preset description}
rubrics:
  - name: design-quality
    weight: 0.20
  - name: functionality
    weight: 0.25
  - name: code-quality
    weight: 0.15
  # ... more rubrics
---
```

**Constraint:** All `rubrics[].weight` values MUST sum to 1.0 (±0.01 tolerance). Enforced by `validate-rubric.sh --preset`.
