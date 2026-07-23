---
name: "resolving-merge-conflicts"
description: "Resolve an in-progress git merge or rebase conflict end to end: read the conflict state, recover each side's original intent, resolve every hunk, run the project's checks, and prepare the merge/rebase for an explicitly approved finish. Use when asked to \"resolve merge conflicts\", \"fix this rebase\", \"finish the merge\", or when `git status` shows conflicted (unmerged) paths. NOT for the full ship pipeline that merges the base branch first (see mk:ship); NOT for debugging a runtime bug or test fail"
---

# Resolving Merge Conflicts

> **Path convention:** Commands assume cwd is the repo root (`$(git rev-parse --show-toplevel)`).

**Iron Laws**

- **Resolve every conflict; do not abandon by default.** `git merge --abort` or
  `git rebase --abort` requires explicit user direction. Completing the operation with
  a commit or `git rebase --continue` also requires explicit user go-ahead.
- **Do not invent new behaviour.** Resolution combines existing intents; it is not a
  place to add features or refactor.

## When to Use

- `git status` shows `Unmerged paths` / "you have unmerged files"
- A `git merge`, `git rebase`, `git cherry-pick`, or `git pull` stopped on conflicts
- User says "resolve the conflicts", "fix the rebase", "finish the merge"

**Do NOT use when:** no operation is in progress (nothing to resolve), or the request is
to start a merge/ship from scratch (use `mk:ship`).

## Workflow Integration

**Phase: on-demand.** Most often fires inside Phase 5 (Ship) when `mk:ship` merges the
base branch and hits conflicts. Hands control back once the working tree is clean and
checks pass.

## Process

Copy this checklist and track progress:

```
- [ ] 1. See the current state (operation type + conflicted files)
- [ ] 2. Find the primary sources (why each side changed)
- [ ] 3. Resolve each hunk (preserve both intents)
- [ ] 4. Run the project's automated checks
- [ ] 5. Present resolved state and obtain approval to finish the merge/rebase
```

### 1. See the current state

Determine whether a **merge** or a **rebase** is in progress — the finish step differs.

```bash
git status                                   # human summary + hint line
git diff --name-only --diff-filter=U         # exact conflicted (unmerged) files
ls .git/MERGE_HEAD 2>/dev/null && echo MERGE # present => merge in progress
ls -d .git/rebase-merge .git/rebase-apply 2>/dev/null && echo REBASE
git log --oneline -5 --all --decorate        # orient on recent history
```

Read every conflicted file. Note each `<<<<<<< / ======= / >>>>>>>` hunk and which
labels mark each side (`HEAD`/`ours` vs the incoming branch/commit).

> **Rebase side-swap:** during a rebase `ours` is the branch being rebased ONTO and
> `theirs` is your commit being replayed — the opposite of a merge. Confirm before
> assuming which side is "yours".

### 2. Find the primary sources

For each conflict, understand *why* each change was made — do not guess from the diff alone.

```bash
git log --merge -p -- <file>                 # commits touching the conflict on both sides
git log -p <side> -- <file>                  # full history of one side's hunk
gh pr list --state merged --search <term>    # the PR that introduced the change
gh pr view <num> ; gh issue view <num>       # stated intent, linked tickets
```

Read commit messages, PR descriptions, and linked issues. The goal is the *original
intent* behind each side, not just the textual difference.

### 3. Resolve each hunk

For every hunk, in order of confidence:

1. **Preserve both intents** where they are compatible — combine the two changes so
   neither is lost. This is the default and most common outcome.
2. **Where incompatible**, pick the side matching the **stated goal of the merge/rebase**
   (e.g. "merge feature X into main" → keep X's behaviour) and note the trade-off so the
   discarded intent is visible to the user.
3. Remove **all** conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`). Verify none remain:
   `git grep -nE '^(<{7}|={7}|>{7})' -- <files>` returns nothing.
4. Stage each file as it is finished: `git add <file>`.

Never resolve by blindly taking one whole side (`-X ours`/`-X theirs`) unless the file's
two sides are genuinely one-or-the-other — that silently drops the other intent.

### 4. Run the project's automated checks

Discover the checks before running them (do not assume). Typical order: **typecheck →
tests → format.**

```bash
cat package.json        # scripts: typecheck / lint / test / build / format
ls Makefile justfile pyproject.toml Cargo.toml go.mod 2>/dev/null
```

Run what exists (for this kit: `npm run typecheck`, `npm test`, `npm run lint`). Fix
anything the merge broke — a resolution can be marker-free yet semantically wrong (e.g.
a function both sides renamed differently). Re-run until green.

### 5. Obtain approval, then finish the merge/rebase

- **Ask first:** present the resolved files and check results. Do not run the following
  commands until the user explicitly approves completion.
- **Merge:** stage everything, then commit. The prepared message is usually correct;
  keep it conventional and free of AI references.
  ```bash
  git add -A
  git commit --no-edit        # or write a conventional message if none is prepared
  ```
- **Rebase:** continue, and **loop** — a rebase pauses once per conflicting commit.
  ```bash
  git add -A
  git rebase --continue       # repeat steps 1-4 for each subsequent pause
  ```
  Repeat until `git status` reports the rebase is complete (no further stops).

Confirm a clean tree (`git status` → "nothing to commit, working tree clean") before
handing off.

## Output Format

```
## Merge Conflict Resolution: {merge|rebase} of {source} into {target}

**Conflicted files:** {n}
**Resolution summary:**
- {file}: {kept both | chose {side} because {merge goal} — dropped {discarded intent}}

**Checks:** typecheck {pass/fail} · tests {pass/fail} · format {pass/fail}
**Finished:** {awaiting approval | commit sha | rebase complete}
```

## Failure Handling

| Failure | Recovery |
|---------|----------|
| Cannot tell which side's intent should win | Surface both intents + the merge's stated goal to the user; ask — do NOT abort |
| Checks fail after markers removed | Resolution is semantically wrong; re-read both sides' intent (step 2) and fix |
| Conflict markers left in a file | `git grep -nE '^(<{7}|={7}|>{7})'`; resolve remaining hunks before staging |
| Rebase keeps re-conflicting on the same lines | Consider `git rerere`; otherwise resolve each pause carefully — never `--skip` a commit without user approval |
| Binary file conflict | Choose a version explicitly (`git checkout --ours/--theirs <file>`) after confirming intent with the user |

## Handoff Protocol

On a clean tree with green checks → return to `mk:ship` (if mid-ship) or `mk:verify` to
confirm the full build is green before continuing.

## Gotchas

- **`ours`/`theirs` invert between merge and rebase** — during rebase, `ours` is the
  upstream you are replaying onto, not your own work. Confirm direction before picking a side.
- **Marker-free ≠ resolved** — code with no conflict markers can still be semantically
  broken (both sides edited the same logic differently). Step 4's checks are what prove it.
- **`git rebase --continue` pauses repeatedly** — one stop per conflicting commit. It is
  not done until `git status` says so; resolving the first pause is not the end.