# Review and done (stages 5 and 6)

## Review

1. Record the base and head commits of the integration branch in the ledger, so the round
   reviews a fixed range.
2. Run `mk:review` in a fresh context (a subagent or a new session) in branch-diff mode, with
   the integration worktree as its working directory, and give it the brief, the acceptance
   list and the recorded base commit as the base to diff against. It writes one verdict across its dimensions. A FAIL dimension is a "fix now" finding;
   `Side Effects Detected: Yes` waits for the user: stop and ask.
3. Classify each finding:
   - **fix now**: inside the brief; dispatch a fix to a worker, merge, gate, re-review;
   - **ruling**: you decide not to change it; log why in the ledger and name it in the report;
   - **out of scope**: real but outside the brief; list it in the report for a later task, do
     not fix it in this run.
4. At most 3 rounds. A "fix now" finding still open after round 3 means the cap is reached:
   stop and ask.

## Done

Run each acceptance check yourself on the integrated tree, through the host runner for heavy
ones (`references/host-and-cleanup.md`). Set `passes` and `evidence` from what finished.

The run is done when every item passes, the review is clean or ruled, and the cleanup receipt
is written. Otherwise it is partial.

## The report

```markdown
# Delivery: <goal>

Result: done | partial
Branch / PR: <name or link>

## Acceptance
| id | check | result | evidence |

## Not verified
- <manual items, checks still queued or running with their job ids>

## Rulings
- <each ruling, one line>

## Out of scope findings
- <for a later task>

## Cleanup receipt
<from references/host-and-cleanup.md>
```

Say "partial" whenever any item does not pass. Never round a running check up to a pass.
