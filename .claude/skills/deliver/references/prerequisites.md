# Prerequisites (stage 2)

A run that stalls at hour two on a missing token wastes the user's absence. Find every input
the run cannot provide or decide alone now, while the user is still here.

## The matrix

For each group, list what this brief needs. Each row says what it is, why the run needs it,
where the user gets it, and the command that verifies it without changing anything.

| Group | Typical rows | Verify by |
| --- | --- | --- |
| Access and auth | git remote reachable, CLI sessions (`gh auth status`) | a read-only command |
| Secrets and config | an environment variable or secret store entry the code needs | presence only: `test -n "$VAR"`; never print, log or copy the value |
| Accounts and quotas | API quota, CI minutes, package registry access | a status or list command |
| Data and assets | fixtures, sample files, a test database | the file or connection exists |
| Authority | may the run push a branch, open a PR, merge? | the user's answer, recorded in the brief |
| Decisions only the user owns | naming, product behaviour, anything the brief left open | the user's answer, recorded in the brief |
| Environment | toolchain versions, installed CLIs, free disk space | `--version`, `command -v`, the host verdict |
| Machine | `mewkit host status` works and its verdict | `references/host-and-cleanup.md` (Prepare) |

A row is **verified**, **waived** (the user said to go on without it; write the consequence
into the brief) or **unknown**. Unknown blocks the run.

## Asking for what is missing

Send one short list of the unknown rows: what, why, where to get it, how you will check it.
Secrets go into the environment or the secret store, never into the conversation. When the
user says ready, re-run the checks; list whatever is still missing and wait again.

A decision that is reversible and that the user would not care about is yours: take the
conventional default and list it under the brief's defaults instead of asking.

## Caps

Record the caps in the brief: wall clock, dispatch rounds, review rounds (3). Reaching one is
a stop, not a reason to try harder. (Re-dispatching one failed piece at most twice is a
per-piece rule, not a cap: after it the run rules on the piece.)

## Stale prerequisites

A row checked at the start can fail later (a session expires, a quota runs out). When a check
the run depends on fails during execution, check that row again; if it no longer holds, stop and
ask (stop list).
