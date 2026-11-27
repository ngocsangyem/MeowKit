---
name: mk:worktree
description: "Git worktree lifecycle for agents. NOT for mk:team-config."
argument-hint: '[create|merge|cleanup|list|status|prune] [agent-name]'
source: local
keywords:
  - worktree
  - git-worktree
  - parallel-isolation
  - parallel-agents
  - branch-setup
  - task-decomposition
  - orchestration
  - worktree-cleanup
  - worktree-status
  - worktree-health
when_to_use: "Parallel agents need branches."
user-invocable: false
owner: git
criticality: medium
status: active
runtime: claude-code
---

# Git Worktree Manager

Manages git worktrees for parallel agent isolation. Each parallel agent works in its own
worktree to prevent file conflicts. Backed by `scripts/worktree.cjs`.

See `references/commands.md` for full option reference and JSON field docs.

## Actions

### create

Pre-flight: get repo info, then create a parallel worktree.

```bash
# Step 1: verify repo state
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs info --json

# Step 2: create parallel agent worktree
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs create "{agent-name}" --orchestrated --json
```

Every worktree lands under `<main checkout>/.worktrees/`, also when the script runs inside
a linked worktree; `--worktree-root` or `WORKTREE_ROOT` overrides it, with a warning. The
script writes `.worktrees/.gitignore` (`*`) itself, so the user's `.gitignore` is never edited.

The orchestrated worktree is `.worktrees/{agent-name}` on branch
`parallel/{agent-name}-{timestamp}` per `.claude/skills/cook/references/parallel-execution-rules.md` Rule 3.
Give the returned `worktreePath` to the agent as its working directory.
Also give it its own `TMPDIR` at `<main checkout>/.worktrees/.tmp/{agent-name}`: outside the
worktree, so temp files never show in its tree, and already ignored. Heavy commands follow
`.claude/skills/verify/references/heavy-commands.md` (beta).

### merge

Merge a completed parallel branch back to the feature branch using no-fast-forward:

```bash
git merge --no-ff {branch} -m "merge: parallel/{agent-name} into {feature-branch}"
```

On conflict: list the conflicting files, stop and report to the lead (see Gotchas).

On success: run the full test suite (.claude/skills/cook/references/parallel-execution-rules.md Rule 5). After integration
test passes, delegate to `project-manager` (background):

```
"Generate delivery status for plan at {plan-dir}. Write report to
{plan-dir}/status-reports/{YYMMDD}-status.md (create subdir if absent).
Load template from .claude/skills/status/assets/pm-status-template.md.
Run in the background — do not block the caller."
```

Skip PM delegation if `MEOWKIT_PM_AUTO=off` is set in environment.

### cleanup

Before removing a worktree, ensure the parallel agent has released its task ownership
in `mk:task-queue`. Then:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs remove "{agent-name}" --json
```

`remove` acts only on worktrees this script created (`owner` `kit`, or `legacy` for an
unmarked one under `.worktrees/`). Any other match fails with `FOREIGN_WORKTREE`; a worktree
with uncommitted or untracked work fails with `WORKTREE_DIRTY` unless `--discard-changes`.

### list, status, prune, review-pr, review-pr-cleanup

Each is `node ${CLAUDE_SKILL_DIR}/scripts/worktree.cjs <verb> ... --json`; options and output fields are in `references/commands.md`.

- `list`: every worktree with its `owner` (`main`, `kit`, `review`, `legacy`, `foreign`). `status`: the same plus divergence from base and dirty state.
- `prune`: stale worktree metadata; run `--dry-run` first.
- `review-pr`: a detached, SHA-bound worktree from a PR head, fetched from the PR's base remote (never a fork) for a review that never touches the user's checkout; writes `tasks/reviews/<session>/manifest.json`.
- `review-pr-cleanup`: removes a review worktree given only its manifest path; `--sweep` (dry-run unless `--apply`) clears stale sessions.

## Gotchas

One list, each rule with its reason.

- **Never create worktrees on `main` or `master`**; use a feature branch, so parallel work never lands on the protected branch.
- **Never force-push from a worktree.** Worktrees share one `.git`, so a force-push rewrites history for the main checkout too.
- **`remove` refuses uncommitted work** (`WORKTREE_DIRTY`, untracked files included); commit or move it first. Pass `--discard-changes` only when the work is meant to go. Ignored files (a copied `.env`) are not checked and are deleted with the worktree. (`review-pr-cleanup` is the exception: review worktrees are legitimately dirty, and the manifest nonce is the guard.)
- **`remove` never touches a worktree this script did not create** (`FOREIGN_WORKTREE`): other runtimes keep their own worktrees, and their uncommitted work is theirs. Worktrees left in the old sibling or superproject `worktrees/` roots are `foreign` too; remove them with `git worktree remove`.
- **Clean up worktrees after merge.** A stale worktree keeps its branch checked out and blocks reuse of the name.
- **Release the task's ownership in `mk:task-queue` before cleanup**, or the task stays claimed and no other agent can take it.
- **Keep to three active worktrees**: the cap in `.claude/skills/cook/references/parallel-execution-rules.md` Rule 2. The script does not enforce it; `status` lists the worktrees so you can count.
- **Stop on merge conflicts** (common in `SKILL.md` and `CLAUDE.md` during parallel runs), report to the lead, and do not auto-resolve: a human or the lead agent decides.
- **`review-pr` worktrees are detached** (no branch) and owned by their manifest nonce; `review-pr-cleanup` refuses any worktree whose back-reference nonce does not match, which is what makes cross-session deletion impossible.
- **Creation fails if the branch already exists** (`BRANCH_CHECKED_OUT`); timestamps in orchestrated branch names prevent most collisions.
- **`git worktree remove` fails silently if the directory was already deleted by hand**; the script checks existence first via `getWorktreeRecords()`.

## Integration

- Called by orchestrator (`mk:cook`, `mk:workflow-orchestrator`) when decomposing COMPLEX tasks
- Coordinates with `mk:task-queue` for task claiming and ownership enforcement during parallel runs
- Delegates to `project-manager` after merge integration test passes
  (post-phase-delegation Rule 1, background mode)
- Respects `MEOWKIT_PM_AUTO=off` — skip PM delegation when set
- Not invoked directly by users
