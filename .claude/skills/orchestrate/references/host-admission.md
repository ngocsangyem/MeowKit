# Host admission for parallel jobs (beta)

Parallel jobs share one machine. `mewkit host` reports how loaded it is and queues heavy
commands; this file says how dispatch uses it. How an individual agent runs a heavy command
lives in `.claude/skills/verify/references/heavy-commands.md`.

If `mewkit host status` is not a command on this machine, dispatch by `concurrency` and the
internal-agent limit alone.

## How many jobs at once

Run at most the smallest of:

1. the spec's `concurrency`;
2. the internal-agent limit (Rule 2 in `.claude/skills/cook/references/parallel-execution-rules.md`);
3. what the host verdict allows: `go` no extra limit, `throttle` or `unknown` 1 heavy job,
   `clean` or `hold` no new heavy job.

The verdict can only lower the number, never raise it.

## When to stop dispatching

Check `mewkit host status --json` before each new dispatch. Hold new jobs while:

- more heavy jobs are queued than twice the slots running (`mewkit host jobs list --all`: the queue is machine-wide), or
- `data.thermal` is 2 or more (heavy thermal pressure).

Running jobs continue; dispatch resumes when the condition clears.

## Progress line

Append one segment to each progress line, from `mewkit host status --json`:

`host: <verdict> · disk <busy>% <latency>ms · thermal <n> · free <n> GB`

from `data.verdict`, `data.disk.busy_pct`, `data.disk.latency_ms`, `data.thermal` and the
lowest `data.space[].free_gb`. Use `n/a` for a missing field. Do not copy process command lines into the progress line or
the report.
