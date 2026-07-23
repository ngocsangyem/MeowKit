# /orchestrate — Multi-Runtime Job Coordinator

## Usage

```
/orchestrate [task description]
/orchestrate [task description] --internal
/orchestrate [job-spec.yaml]
/orchestrate [job-spec.yaml] --yes
/orchestrate --resume tasks/reports/orchestrate-<timestamp>
```

## Purpose

Coordinate staged or parallel jobs across live-verified coding-agent runtimes
(Claude Code, Codex, Cursor, and other installed CLIs) and in-session MeowKit
subagents. Each job is routed by capability and risk, isolated in a git worktree
when it writes in parallel, captured, resumable, and blocked until an independent
arbiter verifies the results. The authoritative procedure lives in `mk:orchestrate`.

## Dispatch

Activate `mk:orchestrate` with the user's task description, job-spec path, or
`--resume <run-dir>`. Resolve every runtime, model, and agent from live evidence
during the run — never from memory or a prior report.

## Flags

- `--internal` — Routing *preference*: consider in-session subagents first for
  jobs without an explicit `runtime:`. Not a hard mode — a CLI fallback is
  allowed when a job needs a separately selectable model or stronger isolation.
- `--yes` — Pre-approve the exact destructive scope described in the spec. Does
  not approve anything the spec does not already describe.

## Safety notes

- Secrets are refused at intake and redacted from every artifact
  (`injection-rules.md`).
- Destructive, deploy, release, delete, or credentialed jobs require explicit
  human approval for that exact scope, recorded per
  `intervention-recording-rules.md`. `--internal` prompt-only isolation may never
  carry destructive/credentialed work.
- In-session parallel fan-out honors `parallel-execution-rules.md` (max 3
  concurrent agents, zero file-ownership overlap, worktree isolation for writers).
- Gate 1 and Gate 2 are never self-approved by orchestration (`gate-rules.md`).
- Prefer a direct single-agent workflow (`mk:cook`) when orchestration adds no
  parallelism, staged dependency, runtime diversity, or arbiter value.
