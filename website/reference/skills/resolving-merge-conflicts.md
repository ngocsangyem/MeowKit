---
title: "mk:resolving-merge-conflicts"
description: "Resolve an in-progress git merge or rebase conflict end to end — read state, recover each side's intent, resolve hunks, run checks, finish the merge/rebase."
---

# mk:resolving-merge-conflicts

## What This Skill Does

Drives an **in-progress** git merge or rebase to a clean finish. It reads the conflict state, recovers the original intent behind each side from history and PRs, resolves every hunk (preserving both intents where compatible), runs the project's checks, and completes the merge or rebase with a commit. Two iron laws govern it: **always resolve — never `--abort`**, and **never invent new behavior**.

## When to Use

- `git status` shows `Unmerged paths` / "you have unmerged files"
- A `git merge`, `git rebase`, `git cherry-pick`, or `git pull` stopped on conflicts
- User says "resolve the conflicts", "fix this rebase", "finish the merge"
- **NOT for:** the base-branch merge step of the full ship pipeline (see `mk:ship`); debugging a runtime bug or test failure unrelated to a conflict (see `mk:investigate` / `mk:fix`); starting a merge from scratch when nothing is in progress

## Core Capabilities

- **Detect operation type:** merge vs rebase (`.git/MERGE_HEAD` vs `rebase-merge`/`rebase-apply`) — the finish step differs
- **Recover intent:** `git log --merge`, per-side history, and `gh pr`/`gh issue` lookups to understand *why* each side changed, not just the textual diff
- **Resolve each hunk:** preserve both intents by default; on genuine incompatibility, pick the side matching the merge's stated goal and note the dropped intent; strip every conflict marker
- **Run the project's checks:** discover then run typecheck → tests → format; fix anything the merge broke (marker-free code can still be semantically wrong)
- **Finish:** commit (merge) or loop `git rebase --continue` until every replayed commit is applied

## Usage

```bash
/mk:resolving-merge-conflicts          # resolve whatever merge/rebase is in progress
```

## Example Prompt

```
I tried to rebase my branch onto main and it stopped with conflicts in three files.
Resolve them and finish the rebase.
```

## Workflow phases

1. **See the current state** — `git status`, `git diff --name-only --diff-filter=U`, detect merge vs rebase, read every conflicted hunk and which side each label marks.
2. **Find the primary sources** — read commit messages, PR descriptions, and linked issues to recover each side's original intent.
3. **Resolve each hunk** — preserve both intents where compatible; otherwise choose per the merge's goal and record the trade-off; remove all markers and stage each file.
4. **Run the project's automated checks** — typecheck → tests → format; re-run until green.
5. **Finish the merge/rebase** — stage and commit (merge), or `git rebase --continue` and repeat for each subsequent pause.

## Output format

```
## Merge Conflict Resolution: {merge|rebase} of {source} into {target}

**Conflicted files:** {n}
**Resolution summary:**
- {file}: {kept both | chose {side} because {merge goal} — dropped {discarded intent}}

**Checks:** typecheck {pass/fail} · tests {pass/fail} · format {pass/fail}
**Finished:** {commit sha | rebase complete}
```

## Gotchas

- **`ours`/`theirs` invert between merge and rebase** — during a rebase, `ours` is the upstream you are replaying onto, not your own work. Confirm direction before picking a side.
- **Marker-free ≠ resolved** — code with no conflict markers can still be semantically broken when both sides edited the same logic differently. The step-4 checks are what prove the resolution.
- **`git rebase --continue` pauses repeatedly** — one stop per conflicting commit. It is not done until `git status` says so.

## Handoff Protocol

On a clean tree with green checks → return to `mk:ship` (if mid-ship) or `mk:verify` to confirm the full build is green before continuing.
