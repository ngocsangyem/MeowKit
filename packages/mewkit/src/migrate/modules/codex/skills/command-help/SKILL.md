---
name: "command-help"
description: "command-help"
---

# /help — Workflow Navigation (What Should I Do Next?)

## Usage

```
/help [--verbose]
```

## Behavior

Thin wrapper that invokes the `mk:help` skill — the forward-looking navigator. It scans
project state (paused workflows, plans, reviews, uncommitted changes, plus checkpoint /
budget / detected-model / verdict / roadmap sources) and emits a ranked top-3 of next
steps mapped to the 7-phase pipeline.

Read-only: it reads state, never writes it. Backward-looking delivery status stays with
`the status skill` (project-manager) — this command does not duplicate it.

### Execution

1. Activate the `mk:help` skill.
2. Pass `--verbose` through when supplied (adds full state-scan output + which additional
   sources were present vs skipped).

### Output

A `## Status` block: current phase + state, a "Recommended Next Step" (rank-1), and "Other
Options" (ranks 2–3) each with a one-line rationale citing the source evidence.

See `.agents/skills/help/SKILL.md` for the scan sources, ranking heuristic, and the
JSON-compatible next-steps shape.