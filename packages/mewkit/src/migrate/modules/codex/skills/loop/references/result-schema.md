# Result Schema

Single source of truth for the loop's artifacts. SKILL.md and `loop-protocol.md` link
here; they never restate the schema.

## Contents

- Output directory
- TSV schema
- summary.md
- handoff.json
- Resume / progress state
- Back to [`loop-protocol.md`](loop-protocol.md)

---

## Output Directory

```
tasks/reports/loop-{YYMMDD-HHMM}-{slug}/
├── loop-results.tsv
├── summary.md
└── handoff.json
```

`{slug}` is a short kebab-case derivation of the Goal. These are project artifacts under the
framework `tasks/` tree — no skill-directory writes, and no `the project environment` needed
(framework dirs are exempt from the persistent-state rule).

---

## TSV Schema

First line is a comment carrying the metric direction; second line is the header.

```
# metric_direction: higher_is_better|lower_is_better
iteration	timestamp	commit	metric	delta	guard	status	description
```

| Column | Type | Notes |
| --- | --- | --- |
| iteration | int | 0 = baseline |
| timestamp | ISO-8601 | when the row was logged |
| commit | string | short SHA, or `-` if discarded/crashed |
| metric | number | measured value |
| delta | number | signed change vs best; `-` for baseline |
| guard | enum | `pass` / `fail` / `-` (no guard set) |
| status | enum | see below |
| description | string | one sentence; secrets masked |

**Statuses:** `baseline`, `keep`, `discard`, `guard-failed`, `crash`, `metric-error`,
`no-op`, `interrupted`.

```
# metric_direction: lower_is_better
iteration	timestamp	commit	metric	delta	guard	status	description
0	2026-05-30T20:10:00	a1b2c3d	842	-	-	baseline	initial bundle size
1	2026-05-30T20:11:10	e4f5a6b	810	-32	pass	keep	tree-shake unused lodash imports
2	2026-05-30T20:12:05	-	798	-	pass	no-op	remove dead css — below min-delta
3	2026-05-30T20:13:20	-	-	-	-	crash	build errored on dynamic import rewrite
```

---

## summary.md

Human-readable wrap-up:

- Config (goal, metric+unit, direction, scope, iterations cap, noise, min-delta, stop-at)
- Baseline → final metric, with absolute and % change
- Counts: kept / discarded / guard-failed / crashed / no-op
- Kept-commit SHAs (note: user may interactively squash `*(loop):` commits)
- Stop reason (goal reached / capped / stuck / plateau / interrupted)
- Suggested next step (mk:verify / mk:review / mk:ship)
- Secrets masked throughout.

---

## handoff.json

Machine-readable handoff for downstream skills:

```json
{
  "goal": "Reduce main bundle below 200KB",
  "metric": "bundle size (KB)",
  "direction": "lower",
  "baseline": 842,
  "final": 741,
  "delta": -101,
  "kept_commits": ["e4f5a6b", "9a0b1c2"],
  "status": "completed",
  "suggested_next": ["mk:verify", "mk:review", "mk:ship"],
  "report_dir": "tasks/reports/loop-260530-2010-bundle-size"
}
```

`status` ∈ `completed | capped | stuck | plateau | interrupted`.

---

## Resume / Progress State

```
session-state/mk-loop-progress.json
```

Holds resumable state and the concurrent-run lock:

```json
{
  "session_id": "<id>",
  "config": { "...": "parsed config" },
  "report_dir": "tasks/reports/loop-<...>",
  "iteration": 6,
  "best_metric": 741,
  "best_commit": "9a0b1c2",
  "consecutive_discards": 1
}
```

Framework dir → exempt from the persistent-state rule (no `the project environment`). A second
`mk:loop` in the same session refuses to start while this file marks an active run; a stale
lock from a different `session_id` is cleared on start. The file is removed at Stage 4.
