# Evaluator Calibration Set

Golden anchor artifacts used to detect evaluator drift over time. Each artifact is a real (sanitized) past evaluator verdict paired with the source the verdict graded against. Re-running the evaluator against these anchors should produce verdicts that match the recorded gold-standard.

## Purpose

Evaluators drift toward leniency over time, and the drift is silent. The calibration set exists to catch the drift mechanically:

1. Pick a calibration anchor
2. Re-run the current evaluator against the same artifact
3. Compare the new verdict to the gold-standard verdict
4. If verdicts disagree on more than one anchor across the set → drift detected → re-calibrate or escalate (the drift test is owned by `references/rubric-rules.md`)

## Cadence

- **Per model upgrade** (Sonnet 4.5 → 4.6, Opus 4.6 → 4.7, etc.) — mandatory full replay
- **Quarterly** — soft check; replay subset
- **Ad-hoc** — when an evaluator verdict surprises a human ("that should have been FAIL")

## Structure

Each anchor is a directory named `YYMMDD-{slug}-{VERDICT}-anchor` holding `source/` (the artifact graded), `verdict.md` (the gold-standard verdict) and `metadata.yaml` (model, rubric preset, evaluator version). No anchors ship; they accumulate from real `mk:evaluate` runs.

## How to Add a Calibration Anchor

1. Pick a real evaluator verdict that's clearly correct (consensus among reviewers)
2. Sanitize the source artifact — strip names, emails, internal product names, credentials
3. Copy source + verdict + metadata into a new directory under `calibration-set/`
4. Name the directory `YYMMDD-{slug}-{VERDICT}-anchor`
5. Update `metadata.yaml` with the gold-standard expected outputs

## Replay Procedure (by hand)

Run `mk:evaluate` against an anchor's `source/`, compare the new `overall` and per-criterion verdicts with the anchor's `metadata.yaml` and `verdict.md`, and count the criteria that flipped. Replay the whole set before any model upgrade.

The calibration set is not required for the evaluator to work; it exists to catch drift after the fact.
