# Heavy commands on a shared machine (beta)

A full build, test suite or lint run can take minutes and load the whole machine. When
several agents share one machine, run heavy commands through `mewkit host` so they queue
fairly and you get control back within a bounded wait. This file is the one place these
rules live; other skills point here.

`mewkit host` is a beta. If `mewkit host status` is not a command on this machine, run
the commands directly and skip the rest of this file.

## Before a heavy command

Run `mewkit host status` first. It prints a verdict:

| Verdict | Meaning | What to do |
| --- | --- | --- |
| `go` | the machine has room | run it (through `mewkit host run`) |
| `throttle` | the machine is busy | prefer a narrower related check; a heavy run is admitted one at a time |
| `unknown` | load could not be measured | proceed as for `throttle` |
| `clean` | free space is low | run `mewkit host status --caches` and propose the `cargo clean` it lists to the user; do not delete anything yourself |
| `hold` | the machine is overloaded | do other work; a heavy run waits in the queue |

The output also names the processes loading the disk and the worktree each works in, so
you can tell whether the load is yours.

## How to run

- While iterating, run checks related to what changed (`mk:verify` does this by default).
- Run the full suite once, at the end, through the runner:
  `mewkit host run --background -- <command>`, then wait with
  `mewkit host jobs wait <id>`.
- In the foreground, `mewkit host run -- <command>` streams the output and returns within
  a wait sized to your runtime's tool timeout (`--wait 2m` to choose).

## Reading the result

- **The command's own exit code** (0, 1, 3 …): the command finished; read it as usual.
- **An exit 75 is never a pass.** The block it prints starts with
  `QUEUED — NOT STARTED — NOT VERIFIED` or `STILL RUNNING — NOT VERIFIED`. The job keeps
  going on its own. Do other work, then run `mewkit host jobs wait <id>`. Do not re-run the
  same command: an identical command on the same tree attaches to the running job anyway.
- **Exit 70**: the job was lost (its supervisor died) or cancelled; stderr says which. Re-run it once.
- A command can itself exit 75 or 70. Read those codes as the runner's only with its
  `NOT VERIFIED` first line or its `lost`/`cancelled` stderr line; otherwise they are the command's own failure.
- `mewkit host jobs log <id>` shows a job's output (secrets masked); `mewkit host jobs list`
  shows all jobs. Read only the jobs you started.

## Never

- Never skip tests, add `--passWithNoTests`, edit test configuration, or delete tests to
  finish sooner.
- Never stop or kill a process you did not start, even when it is the one loading the disk.
- Never report a check as passed while it is queued or running. Say plainly that it is
  not verified yet, and name the job id.
