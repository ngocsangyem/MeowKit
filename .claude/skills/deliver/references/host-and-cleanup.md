# Host and cleanup (stages 2, 4 and 6, beta)

A delivery run puts several writers, their builds and their test suites on one machine, and
other projects may be using it too. `mewkit host` measures the load and queues heavy commands;
this file says where the run uses it. How one agent runs a heavy command and reads its result
lives in `.claude/skills/verify/references/heavy-commands.md`, which every writer brief names;
this file does not repeat it.

If `mewkit host status` is not a command on this machine, see "Without the host" at the end.

## Prepare (stage 2)

- Add the row "Machine" to the prerequisites: `mewkit host status` runs and prints a verdict.
- Record the starting verdict in the ledger.
- On `clean` (free space is low): run `mewkit host status --caches` and put the cleanup it
  lists to the user with the other missing rows. Delete nothing yourself. No heavy job is
  admitted until the verdict leaves `clean`.
- On `hold`: tell the user the machine is overloaded now; the run can still plan, but no new
  heavy work starts until the verdict improves (the same rule as in Execute).

## Execute (stage 4)

**Wave size.** Before each wave, run `mewkit host status --json`. Start at most the smallest
of: 3 writers, what the runtime allows, and what the verdict allows (`go` no extra limit;
`throttle` or `unknown` one writer doing heavy work, others only light or read-only work;
`clean` or `hold` no new heavy work). Begin with two or three writers and widen only while the
verdict stays `go`.

**Writer briefs.** Every brief says: run builds and full suites through `mewkit host run`
(`--background` then `mewkit host jobs wait <id>` for long ones), follow `heavy-commands.md`,
and report the job id of any check that has not finished. A worker in its own worktree has its
own jobs.

**Monitoring.** `mewkit host jobs list --all` shows the jobs of every worktree on the machine.
Read only the jobs of the run's worktrees. A worker waiting in the queue is waiting, not stuck:
do not re-dispatch it. Do not stop a job or a process the run did not start, even when it loads
the machine.

**Checking a claim.** "Tests pass" from a worker becomes a tick only when the job behind it
ended with exit 0: `mewkit host jobs wait <id>`, or its output read with
`mewkit host jobs log <id>`.

**Post-merge gate.** After each merge, run the gate on the integration worktree:
`mewkit host run --background -- <command>`, then `mewkit host jobs wait <id>`. Write the job
id and its exit code into the ledger's merge line.

**Check-ins.** Each progress line in the ledger carries the host segment (SKILL.md, stage 4,
names where its format and the hold-dispatch conditions live) and the run's open job ids.

## Done (stage 6)

**Acceptance.** Heavy acceptance checks run through the host runner like the gate. The job id
and exit code go into the item's `evidence`. An item stays `passes: false` while its job is
queued or running, and on a runner exit 75 or 70.

**Cleanup receipt.** Before the report, make sure the run leaves nothing behind, and write the
receipt into the report:

```markdown
## Cleanup receipt
- Host jobs of this run: none queued or running (`mewkit host jobs list --all`), or <ids, why>
- Worktrees created: merged pieces removed through `mk:worktree` (`remove`, no
  `--discard-changes`); unmerged or dirty ones kept, with their branches: <paths>
- Processes started (dev servers, watchers, from the ledger): <n> stopped
- Caches: <what `mewkit host status --caches` lists>; reported, not deleted
- Host verdict at the end: <verdict>
```

A dirty worktree, or one whose branch is not merged, is reported and kept, never forced. `mewkit host clean --dry-run` may go in the report;
`mewkit host clean` removes only the toolkit's own stale host state and is the user's call.

## Without the host

Run checks directly. Start at most 2 writers, one at a time doing a build or full suite. Every
other rule holds: a check that has not finished is not verified, and the cleanup receipt still
lists worktrees, processes and caches.
