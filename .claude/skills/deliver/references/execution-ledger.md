# Execution ledger (stage 4 and resume)

The conversation does not survive a long run: it is compacted, cut off or restarted. The run
directory and git do. Write everything a fresh session would need to continue.

## Run directory

`tasks/reports/deliver-<YYMMDD-HHMM>/`:

| File | Written by | Holds |
| --- | --- | --- |
| `brief.md` | stage 1 | the confirmed brief, frozen |
| `acceptance.json` | stage 1, then the orchestrator only | checks and their pass flags |
| `ledger.md` | the orchestrator only | pieces, attempts, rulings, merges, check-ins |

Workers never write these files. They report back; you record.

## ledger.md

```markdown
## Pieces
| id | owns | worktree (from mk:worktree) | status | attempts |
| P1 | src/api/** | .worktrees/deliver-p1 | merged | 1 |

## Attempts
- P1#1 dispatched <time>, brief: <one line>; result: commits a1b2c3, job 42 exit 0; checked

## Started processes
- <time> P1 dev server, pid 4242, port 5173; stopped <time>

## Rulings
- <time> <decision>. Why: <reason>. Cost if wrong: <what breaks and how to undo>.

## Merges
- P1 merged at d4e5f6; post-merge gate: job 57 exit 0

## Check-ins
- <time> 2/4 pieces merged; host go; open jobs: 61
```

## Dispatch

1. Pick the next pieces whose dependencies are merged and whose files no running piece owns.
2. Size the wave from the host verdict (the host rules SKILL.md names for stage 4).
3. Write the attempt line, then dispatch. A dispatch without a ledger line did not happen.
4. Writer brief, self-contained:
   - goal of the piece and how it fits the brief;
   - files it owns and files it must not touch;
   - done-when commands for the piece;
   - run heavy checks through `mewkit host run` and follow
     `.claude/skills/verify/references/heavy-commands.md`; report job ids of checks that have
     not finished;
   - stop conditions (the stop list in SKILL.md);
   - return: commits, changed files, checks run with exit codes or job ids, open questions.

## Checking a worker's claim

Before ticking a piece: the branch has the commits it names; the diff stays inside the files it
owns; every check it says passed has an exit code 0 you can see (its output, or
`mewkit host jobs wait <id>`). A worker that reports failure but left commits and passing
checks on disk is a success after this check. A worker that went silent is checked on disk, not
waited on forever.

## Failure classes

| Class | Response |
| --- | --- |
| Rate limit or quota | pause new dispatches, wait, resume; not a failure of the piece |
| Blocked, needs context | re-dispatch with the missing context (at most twice per piece) |
| Still failing after two re-dispatches | ruling: narrow the piece or defer it; or stop |
| Host `hold` | no new heavy work; do planning, review or checks that are light |

## Merge

The integration branch is created with `mk:worktree` at the start of stage 4 (for example
`deliver-integration`), from the base the brief names; it is never the branch the user has
checked out or the default branch. Merge one piece branch at a time into it. After each merge,
run the post-merge gate (the affected tests, then type-check and build) through the host
runner.

- Writer worktrees start from the integration branch (`--base <integration branch>` when
  creating them with `mk:worktree`), so a piece sees the pieces merged before it.
- A merge that conflicts: `git merge --abort`, then re-dispatch the piece on a fresh worktree
  from the new integration tip. A conflict re-dispatch does not count toward the piece's two.
- Review deletions in every merge diff. A merge that deletes files no piece was meant to delete
  is undone with `git revert -m 1 <merge-commit>` and ruled on. Never `git reset --hard` or
  force anything. A reverted branch cannot simply be merged again: a fixed piece goes on a new
  branch.

## Resume

Reread `brief.md`, `acceptance.json`, `ledger.md`. Then reconcile: `git log` of each piece
branch, `git worktree list`, `mewkit host jobs list` with `--all`. First make sure the worker of an
open attempt has stopped (its session or subagent is gone, no job of its worktree is running).
An attempt with commits on disk is then checked, not repeated; one with nothing on disk is
dispatched again.
