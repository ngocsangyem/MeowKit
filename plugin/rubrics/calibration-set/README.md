# Evaluator Calibration Set

Golden anchor artifacts used to detect evaluator drift over time. Each artifact is a real (sanitized) past evaluator verdict paired with the source the verdict graded against. Re-running the evaluator against these anchors should produce verdicts that match the recorded gold-standard.

## Purpose

Per Anthropic harness research: evaluators drift toward leniency over time, and the drift is silent. The calibration set exists to catch the drift mechanically:

1. Pick a calibration anchor
2. Re-run the current evaluator against the same artifact
3. Compare the new verdict to the gold-standard verdict
4. If verdicts disagree on more than 5% of criteria across the set → drift detected → re-calibrate or escalate

## Cadence

- **Per model upgrade** (Sonnet 4.5 → 4.6, Opus 4.6 → 4.7, etc.) — mandatory full replay
- **Quarterly** — soft check; replay subset
- **Ad-hoc** — when an evaluator verdict surprises a human ("that should have been FAIL")

## Structure

```
calibration-set/
├── README.md                              ← this file
├── 260408-kanban-app-PASS-anchor/         ← one example (gold = PASS)
│   ├── source/                            ← the artifact graded
│   ├── verdict.md                         ← gold-standard verdict
│   └── metadata.yaml                      ← model, rubric preset, evaluator version
└── (more anchors land here over time)
```

## How to Add a Calibration Anchor

1. Pick a real evaluator verdict that's clearly correct (consensus among reviewers)
2. Sanitize the source artifact — strip names, emails, internal product names, credentials
3. Copy source + verdict + metadata into a new directory under `calibration-set/`
4. Name the directory `YYMMDD-{slug}-{VERDICT}-anchor`
5. Update `metadata.yaml` with the gold-standard expected outputs

## Replay Procedure

```bash
# Run evaluator against the calibration source
.claude/skills/evaluate/scripts/run-evaluator.sh \
  .claude/rubrics/calibration-set/260408-kanban-app-PASS-anchor/source

# Compare to gold-standard
diff <(yq '.overall' calibration-set/260408-kanban-app-PASS-anchor/metadata.yaml) \
     <(yq '.overall' tasks/reviews/*-evalverdict.md | tail -1)

# Drift count: how many criteria flipped vs gold
# (Phase 8 benchmark suite automates this; v1 is manual)
```

## v1 Status

Phase 3 (shipped 260408) lands this README as the calibration-set scaffold. No starter anchors ship in v1 — real anchors will accumulate as `mk:evaluate` runs against real builds in Phase 5+. The calibration set is a Phase 8 benchmark concern; v1 just reserves the directory and the convention.

The calibration set is **not** a bootstrap requirement — the evaluator works without it. The set exists to catch drift after the fact.

## Future

Phase 8 (`mk:benchmark`) automates the replay loop and produces a delta table. Until then, calibration replays are run manually before any model upgrade.
